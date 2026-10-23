-- Dedicated project only. Run with the migration login, never the runtime login.
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname='hc_owner') THEN CREATE ROLE hc_owner NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname='hc_writer') THEN CREATE ROLE hc_writer NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname='hc_runtime') THEN CREATE ROLE hc_runtime LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS; END IF;
  IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname IN ('hc_owner','hc_writer','hc_runtime') AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb)) THEN RAISE EXCEPTION 'Unsafe preexisting role'; END IF;
  IF EXISTS (SELECT FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles r ON r.oid=m.member WHERE r.rolname='hc_runtime') THEN RAISE EXCEPTION 'Runtime must not inherit other roles'; END IF;
  EXECUTE pg_catalog.format('GRANT hc_owner, hc_writer TO %I',current_user);
END $roles$;
CREATE SCHEMA hc_private AUTHORIZATION hc_owner;
REVOKE ALL ON SCHEMA hc_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA hc_private TO hc_writer,hc_runtime;

CREATE TABLE hc_private.workspaces(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id uuid UNIQUE NOT NULL);
CREATE TABLE hc_private.memberships(actor_id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES hc_private.workspaces(id), role text NOT NULL CHECK(role='citizen'));
CREATE TABLE hc_private.cases(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES hc_private.workspaces(id),actor_id uuid NOT NULL,idempotency_key uuid NOT NULL,payload jsonb NOT NULL,status text NOT NULL CHECK(status='submitted'),submitted_at timestamptz NOT NULL DEFAULT now(),UNIQUE(actor_id,idempotency_key));
CREATE TABLE hc_private.originals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid UNIQUE NOT NULL REFERENCES hc_private.cases(id),workspace_id uuid NOT NULL,narrative text NOT NULL CHECK(length(narrative) BETWEEN 1 AND 12000));
CREATE TABLE hc_private.concerns(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid NOT NULL REFERENCES hc_private.cases(id),workspace_id uuid NOT NULL,original_id uuid NOT NULL REFERENCES hc_private.originals(id),ordinal integer NOT NULL,type text NOT NULL CHECK(type IN ('service','conduct','mixed')),wording text NOT NULL CHECK(length(wording) BETWEEN 1 AND 2000),UNIQUE(case_id,ordinal));
CREATE TABLE hc_private.events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid NOT NULL REFERENCES hc_private.cases(id),workspace_id uuid NOT NULL,actor_id uuid NOT NULL,sequence integer NOT NULL CHECK(sequence=1),action text NOT NULL CHECK(action='submitted'),original_id uuid NOT NULL REFERENCES hc_private.originals(id),recorded_at timestamptz NOT NULL DEFAULT now(),UNIQUE(case_id,sequence));
ALTER TABLE hc_private.workspaces OWNER TO hc_owner;
ALTER TABLE hc_private.memberships OWNER TO hc_owner;
ALTER TABLE hc_private.cases OWNER TO hc_owner;
ALTER TABLE hc_private.originals OWNER TO hc_owner;
ALTER TABLE hc_private.concerns OWNER TO hc_owner;
ALTER TABLE hc_private.events OWNER TO hc_owner;
ALTER TABLE hc_private.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE hc_private.workspaces FORCE ROW LEVEL SECURITY;
ALTER TABLE hc_private.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE hc_private.memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_actor ON hc_private.workspaces TO hc_writer USING(owner_id = nullif(current_setting('app.actor_id',true),'')::uuid) WITH CHECK(owner_id = nullif(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY membership_actor ON hc_private.memberships TO hc_writer USING(actor_id = nullif(current_setting('app.actor_id',true),'')::uuid) WITH CHECK(actor_id = nullif(current_setting('app.actor_id',true),'')::uuid);
DO $policies$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cases','originals','concerns','events'] LOOP
    EXECUTE pg_catalog.format('ALTER TABLE hc_private.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE pg_catalog.format('ALTER TABLE hc_private.%I FORCE ROW LEVEL SECURITY',t);
    EXECUTE pg_catalog.format('CREATE POLICY workspace_member ON hc_private.%I TO hc_writer USING (workspace_id = nullif(current_setting(''app.workspace_id'',true),'''')::uuid AND EXISTS (SELECT 1 FROM hc_private.memberships m WHERE m.workspace_id = %I.workspace_id AND m.actor_id = nullif(current_setting(''app.actor_id'',true),'''')::uuid)) WITH CHECK (workspace_id = nullif(current_setting(''app.workspace_id'',true),'''')::uuid AND EXISTS (SELECT 1 FROM hc_private.memberships m WHERE m.workspace_id = %I.workspace_id AND m.actor_id = nullif(current_setting(''app.actor_id'',true),'''')::uuid))',t,t,t);
  END LOOP;
END $policies$;
REVOKE ALL ON ALL TABLES IN SCHEMA hc_private FROM PUBLIC,anon,authenticated,hc_runtime;
GRANT SELECT,INSERT ON ALL TABLES IN SCHEMA hc_private TO hc_writer;

CREATE FUNCTION hc_private.bootstrap() RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE actor uuid := nullif(current_setting('app.actor_id',true),'')::uuid; workspace uuid;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Verified actor required' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(actor::text,0));
  SELECT m.workspace_id INTO workspace FROM hc_private.memberships m WHERE m.actor_id=actor;
  IF workspace IS NULL THEN
    INSERT INTO hc_private.workspaces(owner_id) VALUES(actor) RETURNING id INTO workspace;
    INSERT INTO hc_private.memberships(actor_id,workspace_id,role) VALUES(actor,workspace,'citizen');
  END IF;
  RETURN workspace;
END $fn$;

CREATE FUNCTION hc_private.submit_complaint(command_key uuid,body jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE actor uuid := nullif(current_setting('app.actor_id',true),'')::uuid; workspace uuid := nullif(current_setting('app.workspace_id',true),'')::uuid; existing hc_private.cases; cid uuid; oid uuid; submitted timestamptz; item jsonb; position integer := 0;
BEGIN
  IF actor IS NULL OR workspace IS NULL OR NOT EXISTS(SELECT 1 FROM hc_private.memberships m WHERE m.actor_id=actor AND m.workspace_id=workspace AND m.role='citizen') THEN RAISE EXCEPTION 'Membership required' USING ERRCODE='42501'; END IF;
  IF command_key IS NULL OR jsonb_typeof(body) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid input' USING ERRCODE='22023'; END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(body))<>5 OR NOT body ?& ARRAY['narrative','concerns','category','office','declaration'] OR jsonb_typeof(body->'narrative') IS DISTINCT FROM 'string' OR length(btrim(body->>'narrative')) NOT BETWEEN 1 AND 12000 OR body->>'category' IS DISTINCT FROM 'SAMPLE_MUNICIPAL_SERVICE' OR body->>'office' IS DISTINCT FROM 'SAMPLE_MUNICIPAL_DESK' OR body->'declaration' IS DISTINCT FROM 'true'::jsonb OR jsonb_typeof(body->'concerns') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid complaint' USING ERRCODE='22023'; END IF;
  IF jsonb_array_length(body->'concerns') NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'Invalid concerns' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(actor::text||command_key::text,1));
  SELECT * INTO existing FROM hc_private.cases c WHERE c.actor_id=actor AND c.idempotency_key=command_key;
  IF FOUND THEN
    IF existing.payload IS DISTINCT FROM body THEN RAISE EXCEPTION 'Idempotency conflict' USING ERRCODE='HC409'; END IF;
    RETURN jsonb_build_object('id',existing.id,'submittedAt',existing.submitted_at,'status',existing.status);
  END IF;
  INSERT INTO hc_private.cases(workspace_id,actor_id,idempotency_key,payload,status) VALUES(workspace,actor,command_key,body,'submitted') RETURNING id,submitted_at INTO cid,submitted;
  INSERT INTO hc_private.originals(case_id,workspace_id,narrative) VALUES(cid,workspace,body->>'narrative') RETURNING id INTO oid;
  FOR item IN SELECT value FROM jsonb_array_elements(body->'concerns') LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid concern' USING ERRCODE='22023'; END IF;
    IF (SELECT count(*) FROM jsonb_object_keys(item))<>2 OR NOT item ?& ARRAY['type','wording'] OR item->>'type' NOT IN ('service','conduct','mixed') OR jsonb_typeof(item->'wording') IS DISTINCT FROM 'string' OR length(btrim(item->>'wording')) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Invalid concern' USING ERRCODE='22023'; END IF;
    position:=position+1;
    INSERT INTO hc_private.concerns(case_id,workspace_id,original_id,ordinal,type,wording) VALUES(cid,workspace,oid,position,item->>'type',item->>'wording');
  END LOOP;
  INSERT INTO hc_private.events(case_id,workspace_id,actor_id,sequence,action,original_id,recorded_at) VALUES(cid,workspace,actor,1,'submitted',oid,submitted);
  RETURN jsonb_build_object('id',cid,'submittedAt',submitted,'status','submitted');
END $fn$;

CREATE FUNCTION hc_private.read_complaint(cid uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE actor uuid := nullif(current_setting('app.actor_id',true),'')::uuid; workspace uuid := nullif(current_setting('app.workspace_id',true),'')::uuid; result jsonb;
BEGIN
  IF actor IS NULL OR workspace IS NULL OR NOT EXISTS(SELECT 1 FROM hc_private.memberships m WHERE m.actor_id=actor AND m.workspace_id=workspace AND m.role='citizen') THEN RAISE EXCEPTION 'Membership required' USING ERRCODE='42501'; END IF;
  SELECT jsonb_build_object('id',c.id,'submittedAt',c.submitted_at,'status',c.status,'narrative',o.narrative,'office',c.payload->'office','category',c.payload->'category','declaration',true,'concerns',(SELECT jsonb_agg(jsonb_build_object('type',n.type,'wording',n.wording) ORDER BY n.ordinal) FROM hc_private.concerns n WHERE n.case_id=c.id)) INTO result FROM hc_private.cases c JOIN hc_private.originals o ON o.case_id=c.id WHERE c.id=cid AND c.actor_id=actor AND c.workspace_id=workspace;
  RETURN result;
END $fn$;
GRANT CREATE ON SCHEMA hc_private TO hc_writer;
ALTER FUNCTION hc_private.bootstrap() OWNER TO hc_writer;
ALTER FUNCTION hc_private.submit_complaint(uuid,jsonb) OWNER TO hc_writer;
ALTER FUNCTION hc_private.read_complaint(uuid) OWNER TO hc_writer;
REVOKE CREATE ON SCHEMA hc_private FROM hc_writer;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA hc_private FROM PUBLIC,anon,authenticated,hc_runtime;
GRANT EXECUTE ON FUNCTION hc_private.bootstrap(),hc_private.submit_complaint(uuid,jsonb),hc_private.read_complaint(uuid) TO hc_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE hc_writer IN SCHEMA hc_private REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

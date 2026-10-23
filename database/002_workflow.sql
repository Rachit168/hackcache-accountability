-- Append-only fictional reviewer/office workflow. Provisioning is migration-login only.
CREATE TABLE hc_private.demo_principals(actor_id uuid PRIMARY KEY REFERENCES auth.users(id), kind text NOT NULL CHECK(kind IN ('reviewer','office')), office text, CHECK((kind='office' AND office IN ('SAMPLE_MUNICIPAL_DESK','UNRELATED_DEMO_OFFICE')) OR (kind='reviewer' AND office IS NULL)));
CREATE TABLE hc_private.review_assignments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), case_id uuid UNIQUE NOT NULL REFERENCES hc_private.cases(id), reviewer_id uuid NOT NULL REFERENCES hc_private.demo_principals(actor_id));
CREATE TABLE hc_private.outgoing_versions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid NOT NULL REFERENCES hc_private.cases(id), actor_id uuid NOT NULL, command_key uuid NOT NULL, office text NOT NULL CHECK(office='SAMPLE_MUNICIPAL_DESK'), body jsonb NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(), UNIQUE(actor_id,command_key));
CREATE TABLE hc_private.workflow_actions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid NOT NULL REFERENCES hc_private.cases(id),version_id uuid NOT NULL REFERENCES hc_private.outgoing_versions(id),actor_id uuid NOT NULL,office text NOT NULL,command_key uuid NOT NULL,action text NOT NULL CHECK(action IN ('acknowledge','response')),body jsonb NOT NULL,recorded_at timestamptz NOT NULL DEFAULT now(),UNIQUE(actor_id,command_key));
DO $setup$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['demo_principals','review_assignments','outgoing_versions','workflow_actions'] LOOP
  EXECUTE format('ALTER TABLE hc_private.%I OWNER TO hc_owner',t);
  EXECUTE format('ALTER TABLE hc_private.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE hc_private.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON hc_private.%I FROM PUBLIC,anon,authenticated,hc_runtime,hc_writer',t);
  -- Only command-definer role can read; runtime cannot assume it.
  EXECUTE format('CREATE POLICY command_access ON hc_private.%I TO hc_writer USING (true) WITH CHECK (true)',t);
  EXECUTE format('GRANT SELECT ON hc_private.%I TO hc_writer',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['cases','originals','concerns'] LOOP
  EXECUTE format('CREATE POLICY assigned_reviewer ON hc_private.%I FOR SELECT TO hc_writer USING (EXISTS (SELECT 1 FROM hc_private.review_assignments a JOIN hc_private.demo_principals p ON p.actor_id=a.reviewer_id WHERE a.case_id=%I.%I AND a.reviewer_id=nullif(current_setting(''app.actor_id'',true),'''')::uuid AND p.kind=''reviewer''))',t,t,CASE WHEN t='cases' THEN 'id' ELSE 'case_id' END);
 END LOOP;
END $setup$;
GRANT INSERT ON hc_private.outgoing_versions,hc_private.workflow_actions TO hc_writer;

CREATE FUNCTION hc_private.workflow_read(cid uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE actor uuid := nullif(current_setting('app.actor_id',true),'')::uuid; principal hc_private.demo_principals; c hc_private.cases; result jsonb; versions jsonb; actions jsonb;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Verified actor required' USING ERRCODE='42501'; END IF;
 SELECT * INTO principal FROM hc_private.demo_principals WHERE actor_id=actor;
 IF cid IS NULL THEN
  IF principal.kind='reviewer' THEN SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.case_id)), '[]') INTO result FROM hc_private.review_assignments a WHERE a.reviewer_id=actor;
  ELSIF principal.kind='office' THEN SELECT coalesce(jsonb_agg(jsonb_build_object('id',v.case_id)), '[]') INTO result FROM (SELECT DISTINCT case_id FROM hc_private.outgoing_versions WHERE office=principal.office) v;
  ELSE result:='[]'; END IF;
  RETURN jsonb_build_object('kind',coalesce(principal.kind,'citizen'),'cases',result);
 END IF;
 SELECT * INTO c FROM hc_private.cases WHERE id=cid;
 IF principal.kind='office' THEN
  IF NOT EXISTS(SELECT 1 FROM hc_private.outgoing_versions WHERE case_id=cid AND office=principal.office) THEN RETURN NULL; END IF;
 ELSIF principal.kind='reviewer' THEN
  IF NOT EXISTS(SELECT 1 FROM hc_private.review_assignments WHERE case_id=cid AND reviewer_id=actor) THEN RETURN NULL; END IF;
 ELSE
  IF c.id IS NULL OR c.actor_id<>actor THEN RETURN NULL; END IF;
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'actor',actor_id,'office',office,'time',recorded_at,'content',body) ORDER BY recorded_at,id),'[]') INTO versions FROM hc_private.outgoing_versions WHERE case_id=cid AND (principal.kind IS DISTINCT FROM 'office' OR office=principal.office);
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'versionId',version_id,'actor',actor_id,'office',office,'action',action,'time',recorded_at,'content',body) ORDER BY recorded_at,id),'[]') INTO actions FROM hc_private.workflow_actions WHERE case_id=cid AND (principal.kind IS DISTINCT FROM 'office' OR office=principal.office);
 result:=jsonb_build_object('id',cid,'kind',coalesce(principal.kind,'citizen'),'versions',versions,'history',actions);
 IF principal.kind='reviewer' THEN
  result:=result || jsonb_build_object('narrative',(SELECT narrative FROM hc_private.originals WHERE case_id=cid),'concerns',(SELECT jsonb_agg(jsonb_build_object('id',id,'type',type,'wording',wording) ORDER BY ordinal) FROM hc_private.concerns WHERE case_id=cid));
 END IF;
 RETURN result;
END $fn$;

CREATE FUNCTION hc_private.workflow_commit(cid uuid, command_key uuid, action_name text, body jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE actor uuid := nullif(current_setting('app.actor_id',true),'')::uuid; principal hc_private.demo_principals; prior record; item jsonb; source hc_private.concerns; version hc_private.outgoing_versions; result uuid; original text;
BEGIN
 IF actor IS NULL OR command_key IS NULL THEN RAISE EXCEPTION 'Verified actor required' USING ERRCODE='42501'; END IF;
 SELECT * INTO principal FROM hc_private.demo_principals WHERE actor_id=actor;
 PERFORM pg_advisory_xact_lock(hashtextextended(cid::text,2));
 PERFORM pg_advisory_xact_lock(hashtextextended(actor::text||command_key::text,3));
 IF action_name='release' THEN
  IF principal.kind IS DISTINCT FROM 'reviewer' OR NOT EXISTS(SELECT 1 FROM hc_private.review_assignments WHERE case_id=cid AND reviewer_id=actor) THEN RAISE EXCEPTION 'Denied' USING ERRCODE='42501'; END IF;
  SELECT * INTO prior FROM hc_private.outgoing_versions v WHERE v.actor_id=actor AND v.command_key=workflow_commit.command_key;
  IF FOUND THEN IF prior.case_id<>cid OR prior.body IS DISTINCT FROM body THEN RAISE EXCEPTION 'Conflict' USING ERRCODE='HC409'; END IF; RETURN jsonb_build_object('id',prior.id); END IF;
  IF jsonb_typeof(body) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(body))<>3 OR NOT body ?& ARRAY['narrative','reason','concerns'] OR jsonb_typeof(body->'narrative') IS DISTINCT FROM 'string' OR length(btrim(body->>'narrative')) NOT BETWEEN 1 AND 12000 OR jsonb_typeof(body->'reason') IS DISTINCT FROM 'string' OR length(body->>'reason')>2000 OR jsonb_typeof(body->'concerns') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid release' USING ERRCODE='22023'; END IF;
  SELECT narrative INTO original FROM hc_private.originals WHERE case_id=cid;
  IF original IS DISTINCT FROM body->>'narrative' AND length(btrim(body->>'reason'))=0 THEN RAISE EXCEPTION 'Reason required' USING ERRCODE='22023'; END IF;
  IF jsonb_array_length(body->'concerns')<>(SELECT count(*) FROM hc_private.concerns WHERE case_id=cid) OR (SELECT count(DISTINCT value->>'sourceId') FROM jsonb_array_elements(body->'concerns'))<>jsonb_array_length(body->'concerns') THEN RAISE EXCEPTION 'All source concerns required' USING ERRCODE='22023'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(body->'concerns') LOOP
   IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(item))<>4 OR NOT item ?& ARRAY['sourceId','type','wording','reason'] THEN RAISE EXCEPTION 'Invalid concern' USING ERRCODE='22023'; END IF;
   SELECT * INTO source FROM hc_private.concerns WHERE id=(item->>'sourceId')::uuid AND case_id=cid;
   IF NOT FOUND OR source.type IS DISTINCT FROM item->>'type' OR jsonb_typeof(item->'wording') IS DISTINCT FROM 'string' OR length(item->>'wording')>2000 OR jsonb_typeof(item->'reason') IS DISTINCT FROM 'string' OR length(item->>'reason')>2000 OR (source.wording IS DISTINCT FROM item->>'wording' AND length(btrim(item->>'reason'))=0) THEN RAISE EXCEPTION 'Invalid source/reason' USING ERRCODE='22023'; END IF;
  END LOOP;
  INSERT INTO hc_private.outgoing_versions(case_id,actor_id,command_key,office,body) VALUES(cid,actor,command_key,'SAMPLE_MUNICIPAL_DESK',body) RETURNING id INTO result;
 ELSE
  IF principal.kind IS DISTINCT FROM 'office' OR action_name NOT IN ('acknowledge','response') THEN RAISE EXCEPTION 'Denied' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(body) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(body))<>2 OR NOT body ?& ARRAY['versionId','text'] OR jsonb_typeof(body->'text') IS DISTINCT FROM 'string' OR length(btrim(body->>'text')) NOT BETWEEN 1 AND 12000 THEN RAISE EXCEPTION 'Invalid response' USING ERRCODE='22023'; END IF;
  SELECT * INTO version FROM hc_private.outgoing_versions WHERE id=(body->>'versionId')::uuid AND case_id=cid AND office=principal.office;
  IF NOT FOUND THEN RAISE EXCEPTION 'Denied' USING ERRCODE='42501'; END IF;
  SELECT * INTO prior FROM hc_private.workflow_actions a WHERE a.actor_id=actor AND a.command_key=workflow_commit.command_key;
  IF FOUND THEN IF prior.case_id<>cid OR prior.action<>action_name OR prior.body IS DISTINCT FROM body THEN RAISE EXCEPTION 'Conflict' USING ERRCODE='HC409'; END IF; RETURN jsonb_build_object('id',prior.id); END IF;
  IF action_name='response' AND NOT EXISTS(SELECT 1 FROM hc_private.workflow_actions WHERE version_id=version.id AND office=principal.office AND action='acknowledge') THEN RAISE EXCEPTION 'Acknowledge first' USING ERRCODE='22023'; END IF;
  INSERT INTO hc_private.workflow_actions(case_id,version_id,actor_id,office,command_key,action,body) VALUES(cid,version.id,actor,principal.office,command_key,action_name,body) RETURNING id INTO result;
 END IF;
 RETURN jsonb_build_object('id',result);
END $fn$;
GRANT CREATE ON SCHEMA hc_private TO hc_writer;
ALTER FUNCTION hc_private.workflow_read(uuid) OWNER TO hc_writer;
ALTER FUNCTION hc_private.workflow_commit(uuid,uuid,text,jsonb) OWNER TO hc_writer;
REVOKE CREATE ON SCHEMA hc_private FROM hc_writer;
REVOKE ALL ON FUNCTION hc_private.workflow_read(uuid),hc_private.workflow_commit(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated,hc_runtime;
GRANT EXECUTE ON FUNCTION hc_private.workflow_read(uuid),hc_private.workflow_commit(uuid,uuid,text,jsonb) TO hc_runtime;

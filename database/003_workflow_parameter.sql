CREATE OR REPLACE FUNCTION hc_private.workflow_commit(cid uuid, command_key uuid, action_name text, body jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
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
  SELECT * INTO version FROM hc_private.outgoing_versions WHERE id=(workflow_commit.body->>'versionId')::uuid AND case_id=cid AND office=principal.office;
  IF NOT FOUND THEN RAISE EXCEPTION 'Denied' USING ERRCODE='42501'; END IF;
  SELECT * INTO prior FROM hc_private.workflow_actions a WHERE a.actor_id=actor AND a.command_key=workflow_commit.command_key;
  IF FOUND THEN IF prior.case_id<>cid OR prior.action<>action_name OR prior.body IS DISTINCT FROM body THEN RAISE EXCEPTION 'Conflict' USING ERRCODE='HC409'; END IF; RETURN jsonb_build_object('id',prior.id); END IF;
  IF action_name='response' AND NOT EXISTS(SELECT 1 FROM hc_private.workflow_actions WHERE version_id=version.id AND office=principal.office AND action='acknowledge') THEN RAISE EXCEPTION 'Acknowledge first' USING ERRCODE='22023'; END IF;
  INSERT INTO hc_private.workflow_actions(case_id,version_id,actor_id,office,command_key,action,body) VALUES(cid,version.id,actor,principal.office,command_key,action_name,body) RETURNING id INTO result;
 END IF;
 RETURN jsonb_build_object('id',result);
END $fn$;

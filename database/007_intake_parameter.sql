-- Correct observed 42702 in review lookup; retain migration 006.
CREATE OR REPLACE FUNCTION hc_private.intake_command(operation text,command_key uuid,body jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=nullif(current_setting('app.actor_id',true),'')::uuid; d hc_private.intake_drafts; r hc_private.intake_reviews; result jsonb; cid uuid; prior hc_private.flag_dispositions;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Denied' USING ERRCODE='42501'; END IF;
 IF operation IN ('find','save','review') THEN
  IF EXISTS(SELECT 1 FROM hc_private.demo_principals WHERE actor_id=actor) THEN RAISE EXCEPTION 'Citizen required' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(actor::text||command_key::text,6));
 END IF;
 IF operation IN ('find','save') THEN
  SELECT * INTO d FROM hc_private.intake_drafts x WHERE x.actor_id=actor AND x.command_key=intake_command.command_key;
  IF FOUND THEN IF operation='save' AND d.body IS DISTINCT FROM body THEN RAISE EXCEPTION 'Conflict' USING ERRCODE='HC409'; END IF;RETURN to_jsonb(d); END IF;
  IF operation='find' THEN RETURN NULL; END IF;
  IF jsonb_typeof(body->'sources')<>'array' OR jsonb_array_length(body->'sources') NOT BETWEEN 1 AND 6 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(body->'request'->'evidenceIds') x(id) WHERE NOT EXISTS(SELECT 1 FROM hc_private.evidence_uploads e WHERE e.id=x.id::uuid AND e.owner_id=actor)) THEN RAISE EXCEPTION 'Invalid sources' USING ERRCODE='42501'; END IF;
  INSERT INTO hc_private.intake_drafts(actor_id,command_key,body) VALUES(actor,command_key,body) RETURNING * INTO d;RETURN to_jsonb(d);
 ELSIF operation='review' THEN
  SELECT * INTO d FROM hc_private.intake_drafts WHERE id=(intake_command.body->>'draftId')::uuid AND actor_id=actor;IF NOT FOUND THEN RAISE EXCEPTION 'Denied' USING ERRCODE='42501'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(d.body->'request'->'evidenceIds') s(id) WHERE NOT coalesce(body->'version'->'evidenceIds','[]') ? s.id) THEN RAISE EXCEPTION 'Retain source associations' USING ERRCODE='22023'; END IF;
  SELECT * INTO r FROM hc_private.intake_reviews x WHERE x.actor_id=actor AND x.command_key=intake_command.command_key;
  IF FOUND THEN IF r.draft_id<>d.id OR r.version IS DISTINCT FROM body->'version' THEN RAISE EXCEPTION 'Conflict' USING ERRCODE='HC409'; END IF;RETURN to_jsonb(r); END IF;
  INSERT INTO hc_private.intake_reviews(actor_id,command_key,draft_id,version) VALUES(actor,command_key,d.id,body->'version') RETURNING * INTO r;RETURN to_jsonb(r);
 ELSIF operation='read' THEN
  cid:=(body->>'caseId')::uuid;PERFORM hc_private.record_read(cid);
  SELECT to_jsonb(d)||jsonb_build_object('citizenReview',to_jsonb(r),'flags',CASE WHEN EXISTS(SELECT 1 FROM hc_private.review_assignments WHERE case_id=cid AND reviewer_id=actor) THEN i.flags ELSE '[]'::jsonb END,'dispositions',coalesce((SELECT jsonb_agg(to_jsonb(f) ORDER BY recorded_at,id) FROM hc_private.flag_dispositions f WHERE f.case_id=cid),'[]')) INTO result FROM hc_private.case_intake i JOIN hc_private.intake_reviews r ON r.id=i.review_id JOIN hc_private.intake_drafts d ON d.id=r.draft_id WHERE i.case_id=cid;RETURN result;
 ELSIF operation='disposition' THEN
  cid:=(body->>'caseId')::uuid;IF NOT EXISTS(SELECT 1 FROM hc_private.review_assignments WHERE case_id=cid AND reviewer_id=actor) THEN RAISE EXCEPTION 'Denied' USING ERRCODE='42501'; END IF;
  IF body->>'status' NOT IN ('needs_followup','not_misuse','concern_retained') OR length(btrim(body->>'reason')) NOT BETWEEN 1 AND 1200 OR (SELECT count(*) FROM jsonb_object_keys(body))<>3 THEN RAISE EXCEPTION 'Invalid disposition' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(cid::text,2));SELECT * INTO prior FROM hc_private.flag_dispositions x WHERE x.actor_id=actor AND x.command_key=intake_command.command_key;
  IF FOUND THEN IF prior.body IS DISTINCT FROM body THEN RAISE EXCEPTION 'Conflict' USING ERRCODE='HC409'; END IF;RETURN to_jsonb(prior); END IF;
  INSERT INTO hc_private.flag_dispositions(case_id,actor_id,command_key,body) VALUES(cid,actor,command_key,body) RETURNING * INTO prior;PERFORM hc_private.ledger_append(cid,actor,'flag_disposition',to_jsonb(prior));RETURN to_jsonb(prior);
 END IF;
 RAISE EXCEPTION 'Invalid operation' USING ERRCODE='22023';
END $$;

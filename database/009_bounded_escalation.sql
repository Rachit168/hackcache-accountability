-- Fictional DEMO-ESC-1. No statutory timelines, scheduler or automatic resolution.
CREATE TABLE hc_private.escalation_state(case_id uuid PRIMARY KEY REFERENCES hc_private.cases(id),level integer NOT NULL CHECK(level BETWEEN 0 AND 2),started_at timestamptz NOT NULL,offset_hours integer NOT NULL DEFAULT 0 CHECK(offset_hours BETWEEN 0 AND 720),acknowledged boolean NOT NULL DEFAULT false,responded boolean NOT NULL DEFAULT false,claimed_resolution boolean NOT NULL DEFAULT false,investigation_until timestamptz,investigation_reason text);
CREATE TABLE hc_private.escalation_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid NOT NULL REFERENCES hc_private.cases(id),actor_id uuid NOT NULL,command_key uuid NOT NULL,operation text NOT NULL,request jsonb NOT NULL,body jsonb NOT NULL,recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(actor_id,command_key));
CREATE UNIQUE INDEX escalation_once_per_level ON hc_private.escalation_events(case_id,((body->>'toLevel')::integer)) WHERE operation='escalated';
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['escalation_state','escalation_events'] LOOP
 EXECUTE format('ALTER TABLE hc_private.%I OWNER TO hc_owner',t);EXECUTE format('ALTER TABLE hc_private.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE hc_private.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON hc_private.%I FROM PUBLIC,anon,authenticated,hc_runtime,hc_writer',t);EXECUTE format('CREATE POLICY escalation_command ON hc_private.%I TO hc_writer USING(true) WITH CHECK(true)',t);EXECUTE format('GRANT SELECT,INSERT ON hc_private.%I TO hc_writer',t);
END LOOP;END $$;
GRANT UPDATE ON hc_private.escalation_state TO hc_writer;

CREATE FUNCTION hc_private.escalation_read(cid uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=nullif(current_setting('app.actor_id',true),'')::uuid; s hc_private.escalation_state; deadline timestamptz; effective timestamptz; status text; manager boolean; history jsonb;
BEGIN
 PERFORM hc_private.record_read(cid); -- excludes offices and unrelated identities
 manager:=EXISTS(SELECT 1 FROM hc_private.review_assignments a WHERE a.case_id=cid AND a.reviewer_id=actor);
 SELECT * INTO s FROM hc_private.escalation_state WHERE case_id=cid;
 IF NOT FOUND THEN RETURN jsonb_build_object('policy','DEMO-ESC-1','status','not_started','canManage',manager,'history','[]'::jsonb,'evaluation','explicit_only');END IF;
 effective:=clock_timestamp()+make_interval(hours=>s.offset_hours);
 deadline:=s.started_at+CASE WHEN s.acknowledged THEN interval '72 hours' ELSE interval '24 hours' END;
 IF s.acknowledged AND s.investigation_until>s.started_at AND s.investigation_until<=s.started_at+interval '168 hours' THEN deadline:=greatest(deadline,s.investigation_until);END IF;
 status:=CASE WHEN effective>=deadline THEN CASE WHEN s.level=2 THEN 'highest_limit' ELSE 'overdue' END WHEN s.investigation_until>effective THEN 'investigating' WHEN s.responded THEN 'response_received_unverified' WHEN s.acknowledged THEN 'awaiting_response' ELSE 'awaiting_acknowledgement' END;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'actor',e.actor_id,'operation',e.operation,'recordedAt',e.recorded_at,'detail',e.body) ORDER BY e.recorded_at,e.id),'[]') INTO history FROM hc_private.escalation_events e WHERE e.case_id=cid;
 RETURN jsonb_build_object('policy','DEMO-ESC-1','status',status,'level',s.level,'authority',(ARRAY['SAMPLE_MUNICIPAL_DESK','SAMPLE_DISTRICT_AUTHORITY','SAMPLE_HIGHER_OVERSIGHT'])[s.level+1],'startedAt',s.started_at,'effectiveNow',effective,'offsetHours',s.offset_hours,'deadline',deadline,'acknowledged',s.acknowledged,'responseReceived',s.responded,'claimedResolved',s.claimed_resolution,'independentlyResolved',false,'citizenAgreement','not_recorded','investigationUntil',s.investigation_until,'investigationReason',s.investigation_reason,'canManage',manager,'history',history,'evaluation','explicit_only');
END $$;

CREATE FUNCTION hc_private.escalation_command(cid uuid,command_key uuid,action_name text,body jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=nullif(current_setting('app.actor_id',true),'')::uuid;s hc_private.escalation_state;prior hc_private.escalation_events;effective timestamptz;deadline timestamptz;event_body jsonb;event_action text;result uuid;manager boolean;
BEGIN
 IF command_key IS NULL OR actor IS NULL THEN RAISE EXCEPTION 'Denied' USING ERRCODE='42501';END IF;
 PERFORM hc_private.record_read(cid);
 manager:=EXISTS(SELECT 1 FROM hc_private.review_assignments a WHERE a.case_id=cid AND a.reviewer_id=actor);
 IF action_name<>'evaluate' AND NOT manager THEN RAISE EXCEPTION 'Assigned reviewer required' USING ERRCODE='42501';END IF;
 IF jsonb_typeof(body) IS DISTINCT FROM 'object' OR action_name NOT IN ('evaluate','advance','acknowledge','investigate','respond') THEN RAISE EXCEPTION 'Invalid escalation' USING ERRCODE='22023';END IF;
 IF (action_name IN ('evaluate','advance','acknowledge') AND body<>'{}') OR (action_name='investigate' AND ((SELECT count(*) FROM jsonb_object_keys(body))<>1 OR jsonb_typeof(body->'reason') IS DISTINCT FROM 'string' OR length(btrim(body->>'reason')) NOT BETWEEN 10 AND 1000)) OR (action_name='respond' AND ((SELECT count(*) FROM jsonb_object_keys(body))<>2 OR jsonb_typeof(body->'text') IS DISTINCT FROM 'string' OR length(btrim(body->>'text')) NOT BETWEEN 1 AND 2000 OR jsonb_typeof(body->'claimedResolved') IS DISTINCT FROM 'boolean')) THEN RAISE EXCEPTION 'Invalid escalation content' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(cid::text,2));
 PERFORM pg_advisory_xact_lock(hashtextextended(actor::text||command_key::text,9));
 SELECT * INTO prior FROM hc_private.escalation_events e WHERE e.actor_id=actor AND e.command_key=escalation_command.command_key;
 IF FOUND THEN IF prior.case_id<>cid OR prior.request IS DISTINCT FROM jsonb_build_object('action',action_name,'body',body) THEN RAISE EXCEPTION 'Conflict' USING ERRCODE='HC409';END IF;RETURN jsonb_build_object('id',prior.id,'result',prior.body);END IF;
 SELECT * INTO s FROM hc_private.escalation_state WHERE case_id=cid;
 IF NOT FOUND THEN
  IF NOT manager OR action_name<>'evaluate' THEN RAISE EXCEPTION 'Reviewer activation required' USING ERRCODE='42501';END IF;
  INSERT INTO hc_private.escalation_state(case_id,level,started_at,acknowledged,responded) VALUES(cid,0,clock_timestamp(),EXISTS(SELECT 1 FROM hc_private.workflow_actions WHERE case_id=cid AND action='acknowledge'),EXISTS(SELECT 1 FROM hc_private.workflow_actions WHERE case_id=cid AND action='response')) RETURNING * INTO s;
  event_action:='activated';
 ELSE event_action:=action_name;END IF;
 effective:=clock_timestamp()+make_interval(hours=>s.offset_hours);
 deadline:=s.started_at+CASE WHEN s.acknowledged THEN interval '72 hours' ELSE interval '24 hours' END;
 IF s.acknowledged AND s.investigation_until>s.started_at AND s.investigation_until<=s.started_at+interval '168 hours' THEN deadline:=greatest(deadline,s.investigation_until);END IF;
 event_body:=jsonb_build_object('policy','DEMO-ESC-1','level',s.level,'effectiveAt',effective,'deadline',deadline);
 IF action_name='advance' THEN
  IF s.offset_hours>=720 THEN RAISE EXCEPTION 'Demo clock limit' USING ERRCODE='22023';END IF;
  UPDATE hc_private.escalation_state SET offset_hours=least(offset_hours+24,720) WHERE case_id=cid;
  event_body:=event_body||jsonb_build_object('offsetHours',least(s.offset_hours+24,720),'reason','Reviewer advanced fictional clock by 24 hours; evaluation is separate');
 ELSIF action_name='acknowledge' THEN
  IF s.acknowledged THEN RAISE EXCEPTION 'Already acknowledged' USING ERRCODE='22023';END IF;
  UPDATE hc_private.escalation_state SET acknowledged=true WHERE case_id=cid;event_body:=event_body||jsonb_build_object('reason','Reviewer-recorded fictional acknowledgement; not resolution');
 ELSIF action_name='respond' THEN
  IF NOT s.acknowledged OR s.responded THEN RAISE EXCEPTION 'Acknowledge first; one demonstration response per stage' USING ERRCODE='22023';END IF;
  UPDATE hc_private.escalation_state SET responded=true,claimed_resolution=(body->>'claimedResolved')::boolean WHERE case_id=cid;
  event_body:=event_body||body||jsonb_build_object('independentlyResolved',false,'citizenAgreement','not_recorded','reason','Reviewer-recorded fictional response; deadline remains bounded');
 ELSIF action_name='investigate' THEN
  IF NOT s.acknowledged OR effective>=deadline OR s.investigation_until IS NOT NULL THEN RAISE EXCEPTION 'Investigation cannot renew or revive overdue stage' USING ERRCODE='22023';END IF;
  UPDATE hc_private.escalation_state SET investigation_until=least(effective+interval '48 hours',s.started_at+interval '168 hours'),investigation_reason=btrim(body->>'reason') WHERE case_id=cid;
  event_body:=event_body||jsonb_build_object('until',least(effective+interval '48 hours',s.started_at+interval '168 hours'),'reason',btrim(body->>'reason'));
 ELSIF action_name='evaluate' THEN
  IF effective>=deadline AND s.level<2 THEN
   event_action:='escalated';event_body:=event_body||jsonb_build_object('fromLevel',s.level,'toLevel',s.level+1,'reason',CASE WHEN s.responded THEN 'Response unverified; bounded deadline expired' WHEN s.acknowledged THEN 'Substantive response deadline expired' ELSE 'Acknowledgement deadline expired' END);
   UPDATE hc_private.escalation_state SET level=level+1,started_at=effective,acknowledged=false,responded=false,claimed_resolution=false,investigation_until=NULL,investigation_reason=NULL WHERE case_id=cid;
  ELSE event_body:=event_body||jsonb_build_object('reason',CASE WHEN effective>=deadline THEN 'Highest fictional authority limit reached; no further escalation' ELSE 'Deadline not reached or valid bounded investigation hold' END);END IF;
 END IF;
 INSERT INTO hc_private.escalation_events(case_id,actor_id,command_key,operation,request,body) VALUES(cid,actor,command_key,event_action,jsonb_build_object('action',action_name,'body',body),event_body) RETURNING id INTO result;
 PERFORM hc_private.ledger_append(cid,actor,'escalation_'||event_action,event_body||jsonb_build_object('eventId',result));
 RETURN jsonb_build_object('id',result,'result',event_body);
END $$;

-- Existing approved municipal acknowledgement/response commands update only level 0.
CREATE FUNCTION hc_private.escalation_observe_workflow() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.case_id::text,2));
 UPDATE hc_private.escalation_state SET acknowledged=acknowledged OR NEW.action='acknowledge',responded=responded OR NEW.action='response' WHERE case_id=NEW.case_id AND level=0;
 -- Existing workflow action is already committed atomically to the authoritative ledger.
 RETURN NEW;
END $$;
CREATE TRIGGER escalation_workflow_observation AFTER INSERT ON hc_private.workflow_actions FOR EACH ROW EXECUTE FUNCTION hc_private.escalation_observe_workflow();
GRANT CREATE ON SCHEMA hc_private TO hc_writer;
ALTER FUNCTION hc_private.escalation_read(uuid) OWNER TO hc_writer;
ALTER FUNCTION hc_private.escalation_command(uuid,uuid,text,jsonb) OWNER TO hc_writer;
ALTER FUNCTION hc_private.escalation_observe_workflow() OWNER TO hc_writer;
REVOKE CREATE ON SCHEMA hc_private FROM hc_writer;
REVOKE ALL ON FUNCTION hc_private.escalation_read(uuid),hc_private.escalation_command(uuid,uuid,text,jsonb),hc_private.escalation_observe_workflow() FROM PUBLIC,anon,authenticated,hc_runtime;
GRANT EXECUTE ON FUNCTION hc_private.escalation_read(uuid),hc_private.escalation_command(uuid,uuid,text,jsonb) TO hc_runtime;

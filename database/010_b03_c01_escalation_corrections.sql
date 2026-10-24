-- C01: keep DEMO-ESC-1 acknowledgement milestones monotonic and bound no-op
-- evaluation request records. All timestamps below are DEMO effective times;
-- they are not claims about real-world institutional timeliness.
ALTER TABLE hc_private.escalation_state
  ADD COLUMN acknowledgement_missed_effective_at timestamptz;

CREATE OR REPLACE FUNCTION hc_private.escalation_read(cid uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=nullif(current_setting('app.actor_id',true),'')::uuid; s hc_private.escalation_state; deadline timestamptz; effective timestamptz; status text; manager boolean; history jsonb;
BEGIN
 PERFORM hc_private.record_read(cid);
 manager:=EXISTS(SELECT 1 FROM hc_private.review_assignments a WHERE a.case_id=cid AND a.reviewer_id=actor);
 SELECT * INTO s FROM hc_private.escalation_state WHERE case_id=cid;
 IF NOT FOUND THEN RETURN jsonb_build_object('policy','DEMO-ESC-1','status','not_started','canManage',manager,'history','[]'::jsonb,'evaluation','explicit_only');END IF;
 effective:=clock_timestamp()+make_interval(hours=>s.offset_hours);
 deadline:=s.started_at+CASE WHEN s.acknowledgement_missed_effective_at IS NOT NULL THEN interval '24 hours' WHEN s.acknowledged THEN interval '72 hours' ELSE interval '24 hours' END;
 IF s.acknowledged AND s.acknowledgement_missed_effective_at IS NULL AND s.investigation_until>s.started_at AND s.investigation_until<=s.started_at+interval '168 hours' THEN deadline:=greatest(deadline,s.investigation_until);END IF;
 status:=CASE WHEN effective>=deadline THEN CASE WHEN s.level=2 THEN 'highest_limit' ELSE 'overdue' END WHEN s.investigation_until>effective THEN 'investigating' WHEN s.responded THEN 'response_received_unverified' WHEN s.acknowledged THEN 'awaiting_response' ELSE 'awaiting_acknowledgement' END;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'actor',e.actor_id,'operation',e.operation,'recordedAt',e.recorded_at,'detail',e.body) ORDER BY e.recorded_at,e.id),'[]') INTO history FROM hc_private.escalation_events e WHERE e.case_id=cid;
 RETURN jsonb_build_object('policy','DEMO-ESC-1','status',status,'level',s.level,'authority',(ARRAY['SAMPLE_MUNICIPAL_DESK','SAMPLE_DISTRICT_AUTHORITY','SAMPLE_HIGHER_OVERSIGHT'])[s.level+1],'startedAt',s.started_at,'effectiveNow',effective,'offsetHours',s.offset_hours,'deadline',deadline,'acknowledged',s.acknowledged,'acknowledgementMissedEffectiveAt',s.acknowledgement_missed_effective_at,'responseReceived',s.responded,'claimedResolved',s.claimed_resolution,'independentlyResolved',false,'citizenAgreement','not_recorded','investigationUntil',s.investigation_until,'investigationReason',s.investigation_reason,'canManage',manager,'history',history,'evaluation','explicit_only');
END $$;

CREATE OR REPLACE FUNCTION hc_private.escalation_command(cid uuid,command_key uuid,action_name text,body jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=nullif(current_setting('app.actor_id',true),'')::uuid;s hc_private.escalation_state;prior hc_private.escalation_events;effective timestamptz;deadline timestamptz;event_body jsonb;event_action text;result uuid;manager boolean;noop_count integer;
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
 deadline:=s.started_at+CASE WHEN s.acknowledgement_missed_effective_at IS NOT NULL THEN interval '24 hours' WHEN s.acknowledged THEN interval '72 hours' ELSE interval '24 hours' END;
 IF s.acknowledged AND s.acknowledgement_missed_effective_at IS NULL AND s.investigation_until>s.started_at AND s.investigation_until<=s.started_at+interval '168 hours' THEN deadline:=greatest(deadline,s.investigation_until);END IF;
 event_body:=jsonb_build_object('policy','DEMO-ESC-1','level',s.level,'effectiveAt',effective,'deadline',deadline);
 IF action_name='advance' THEN
  IF s.offset_hours>=720 THEN RAISE EXCEPTION 'Demo clock limit' USING ERRCODE='22023';END IF;
  UPDATE hc_private.escalation_state SET offset_hours=least(offset_hours+24,720) WHERE case_id=cid;
  event_body:=event_body||jsonb_build_object('offsetHours',least(s.offset_hours+24,720),'reason','Reviewer advanced fictional clock by 24 hours; evaluation is separate');
 ELSIF action_name='acknowledge' THEN
  IF s.acknowledged THEN RAISE EXCEPTION 'Already acknowledged' USING ERRCODE='22023';END IF;
  UPDATE hc_private.escalation_state SET acknowledged=true,acknowledgement_missed_effective_at=CASE WHEN effective>=s.started_at+interval '24 hours' THEN effective ELSE NULL END WHERE case_id=cid;
  event_body:=event_body||jsonb_build_object('acknowledgementMissed',effective>=s.started_at+interval '24 hours','acknowledgementMissedEffectiveAt',CASE WHEN effective>=s.started_at+interval '24 hours' THEN effective ELSE NULL END,'reason','Reviewer-recorded fictional acknowledgement; missed demo milestone remains recorded; not a real-world timeliness finding or resolution');
 ELSIF action_name='respond' THEN
  IF NOT s.acknowledged OR s.responded THEN RAISE EXCEPTION 'Acknowledge first; one demonstration response per stage' USING ERRCODE='22023';END IF;
  UPDATE hc_private.escalation_state SET responded=true,claimed_resolution=(body->>'claimedResolved')::boolean WHERE case_id=cid;
  event_body:=event_body||body||jsonb_build_object('independentlyResolved',false,'citizenAgreement','not_recorded','reason','Reviewer-recorded fictional response; deadline remains bounded');
 ELSIF action_name='investigate' THEN
  IF NOT s.acknowledged OR s.acknowledgement_missed_effective_at IS NOT NULL OR effective>=deadline OR s.investigation_until IS NOT NULL THEN RAISE EXCEPTION 'Investigation cannot renew or revive overdue stage' USING ERRCODE='22023';END IF;
  UPDATE hc_private.escalation_state SET investigation_until=least(effective+interval '48 hours',s.started_at+interval '168 hours'),investigation_reason=btrim(body->>'reason') WHERE case_id=cid;
  event_body:=event_body||jsonb_build_object('until',least(effective+interval '48 hours',s.started_at+interval '168 hours'),'reason',btrim(body->>'reason'));
 ELSIF action_name='evaluate' THEN
  IF effective>=deadline AND s.level<2 THEN
   event_action:='escalated';event_body:=event_body||jsonb_build_object('fromLevel',s.level,'toLevel',s.level+1,'acknowledgementMissedEffectiveAt',s.acknowledgement_missed_effective_at,'reason',CASE WHEN s.acknowledgement_missed_effective_at IS NOT NULL THEN 'Acknowledgement arrived after the DEMO-ESC-1 fictional milestone; escalation remains actionable' WHEN s.responded THEN 'Response unverified; bounded deadline expired' WHEN s.acknowledged THEN 'Substantive response deadline expired' ELSE 'Acknowledgement deadline expired' END);
   UPDATE hc_private.escalation_state SET level=level+1,started_at=effective,acknowledged=false,acknowledgement_missed_effective_at=NULL,responded=false,claimed_resolution=false,investigation_until=NULL,investigation_reason=NULL WHERE case_id=cid;
  ELSE
   SELECT count(*) INTO noop_count FROM hc_private.escalation_events WHERE case_id=cid AND operation='evaluate_noop' AND body->>'level'=s.level::text;
   IF noop_count>=20 THEN RAISE EXCEPTION 'No-op evaluation request limit reached for this case' USING ERRCODE='22023';END IF;
   event_action:='evaluate_noop';event_body:=event_body||jsonb_build_object('reason','No state change; recorded in bounded request history without appending the complaint ledger');
  END IF;
 END IF;
 INSERT INTO hc_private.escalation_events(case_id,actor_id,command_key,operation,request,body) VALUES(cid,actor,command_key,event_action,jsonb_build_object('action',action_name,'body',body),event_body) RETURNING id INTO result;
 IF event_action<>'evaluate_noop' THEN PERFORM hc_private.ledger_append(cid,actor,'escalation_'||event_action,event_body||jsonb_build_object('eventId',result));END IF;
 RETURN jsonb_build_object('id',result,'result',event_body);
END $$;

CREATE OR REPLACE FUNCTION hc_private.escalation_observe_workflow() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.case_id::text,2));
 UPDATE hc_private.escalation_state SET
  acknowledgement_missed_effective_at=CASE WHEN NEW.action='acknowledge' AND NOT acknowledged AND clock_timestamp()+make_interval(hours=>offset_hours)>=started_at+interval '24 hours' THEN clock_timestamp()+make_interval(hours=>offset_hours) ELSE acknowledgement_missed_effective_at END,
  acknowledged=acknowledged OR NEW.action='acknowledge',
  responded=responded OR NEW.action='response'
 WHERE case_id=NEW.case_id AND level=0;
 RETURN NEW;
END $$;

ALTER FUNCTION hc_private.escalation_read(uuid) OWNER TO hc_writer;
ALTER FUNCTION hc_private.escalation_command(uuid,uuid,text,jsonb) OWNER TO hc_writer;
ALTER FUNCTION hc_private.escalation_observe_workflow() OWNER TO hc_writer;
REVOKE ALL ON FUNCTION hc_private.escalation_read(uuid),hc_private.escalation_command(uuid,uuid,text,jsonb),hc_private.escalation_observe_workflow() FROM PUBLIC,anon,authenticated,hc_runtime;
GRANT EXECUTE ON FUNCTION hc_private.escalation_read(uuid),hc_private.escalation_command(uuid,uuid,text,jsonb) TO hc_runtime;

-- Internal citizen dispute records; no filing with an external authority.
CREATE TABLE hc_private.citizen_disputes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid NOT NULL REFERENCES hc_private.cases(id),actor_id uuid NOT NULL,command_key uuid NOT NULL,target_kind text NOT NULL CHECK(target_kind IN ('office_response','demo_closure_claim')),target_id uuid NOT NULL,version_id uuid,request jsonb NOT NULL,recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(actor_id,command_key),UNIQUE(case_id,target_kind,target_id));
ALTER TABLE hc_private.citizen_disputes OWNER TO hc_owner;
ALTER TABLE hc_private.citizen_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE hc_private.citizen_disputes FORCE ROW LEVEL SECURITY;
REVOKE ALL ON hc_private.citizen_disputes FROM PUBLIC,anon,authenticated,hc_runtime,hc_writer;
CREATE POLICY dispute_command ON hc_private.citizen_disputes TO hc_writer USING(true) WITH CHECK(true);
GRANT SELECT,INSERT ON hc_private.citizen_disputes TO hc_writer;

CREATE FUNCTION hc_private.dispute_read(cid uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=nullif(current_setting('app.actor_id',true),'')::uuid; targets jsonb; history jsonb;
BEGIN
 PERFORM hc_private.record_read(cid);
 SELECT coalesce(jsonb_agg(t ORDER BY t->>'time',t->>'id'),'[]') INTO targets FROM (
 SELECT jsonb_build_object('kind','office_response','id',a.id,'versionId',a.version_id,'text',a.body->>'text','time',a.recorded_at) t FROM hc_private.workflow_actions a WHERE a.case_id=cid AND a.action='response'
 UNION ALL SELECT jsonb_build_object('kind','demo_closure_claim','id',e.id,'versionId',NULL,'text',e.body->>'text','time',e.recorded_at) FROM hc_private.escalation_events e WHERE e.case_id=cid AND e.operation='respond' AND e.body->>'claimedResolved'='true') q;
 SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.recorded_at,d.id),'[]') INTO history FROM hc_private.citizen_disputes d WHERE d.case_id=cid;
 RETURN jsonb_build_object('status','internal_record_only','canSubmit',EXISTS(SELECT FROM hc_private.cases c WHERE c.id=cid AND c.actor_id=actor) AND NOT EXISTS(SELECT FROM hc_private.demo_principals p WHERE p.actor_id=actor),'targets',targets,'history',history,'concerns',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'wording',c.wording) ORDER BY c.ordinal) FROM hc_private.concerns c WHERE c.case_id=cid),'[]'),'evidence',coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.id,'name',e.display_name) ORDER BY ce.ordinal) FROM hc_private.case_evidence ce JOIN hc_private.evidence_uploads e ON e.id=ce.evidence_id WHERE ce.case_id=cid),'[]'));
END $$;

CREATE FUNCTION hc_private.dispute_submit(cid uuid,cmd uuid,input jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=nullif(current_setting('app.actor_id',true),'')::uuid;prior hc_private.citizen_disputes;row hc_private.citizen_disputes;vid uuid;tid uuid;kind text;
BEGIN
 IF actor IS NULL OR cmd IS NULL OR EXISTS(SELECT FROM hc_private.demo_principals p WHERE p.actor_id=actor) OR NOT EXISTS(SELECT FROM hc_private.cases c WHERE c.id=cid AND c.actor_id=actor) THEN RAISE EXCEPTION 'Denied' USING ERRCODE='42501';END IF;
 IF jsonb_typeof(input) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(input))<>5 OR NOT(input ?& ARRAY['targetKind','targetId','reason','concernIds','evidenceIds']) OR input->>'targetKind' NOT IN ('office_response','demo_closure_claim') OR jsonb_typeof(input->'reason') IS DISTINCT FROM 'string' OR length(btrim(input->>'reason')) NOT BETWEEN 10 AND 4000 OR jsonb_typeof(input->'concernIds') IS DISTINCT FROM 'array' OR jsonb_typeof(input->'evidenceIds') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid dispute' USING ERRCODE='22023';END IF;
 kind:=input->>'targetKind';tid:=(input->>'targetId')::uuid;
 IF tid IS NULL OR jsonb_array_length(input->'concernIds')>8 OR jsonb_array_length(input->'evidenceIds')>5 THEN RAISE EXCEPTION 'Invalid references' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(cid::text,2));
 PERFORM pg_advisory_xact_lock(hashtextextended(actor::text||cmd::text,15));
 SELECT * INTO prior FROM hc_private.citizen_disputes d WHERE d.actor_id=actor AND d.command_key=cmd;
 IF FOUND THEN IF prior.case_id<>cid OR prior.request IS DISTINCT FROM input THEN RAISE EXCEPTION 'Conflict' USING ERRCODE='HC409';END IF;RETURN to_jsonb(prior);END IF;
 IF kind='office_response' THEN SELECT a.version_id INTO vid FROM hc_private.workflow_actions a WHERE a.id=tid AND a.case_id=cid AND a.action='response';IF NOT FOUND THEN RAISE EXCEPTION 'Invalid response' USING ERRCODE='22023';END IF;
 ELSE PERFORM 1 FROM hc_private.escalation_events e WHERE e.id=tid AND e.case_id=cid AND e.operation='respond' AND e.body->>'claimedResolved'='true';IF NOT FOUND THEN RAISE EXCEPTION 'Invalid claim' USING ERRCODE='22023';END IF;END IF;
 IF EXISTS(SELECT FROM jsonb_array_elements_text(input->'concernIds') x WHERE NOT EXISTS(SELECT FROM hc_private.concerns c WHERE c.id=x.value::uuid AND c.case_id=cid)) OR EXISTS(SELECT FROM jsonb_array_elements_text(input->'evidenceIds') x WHERE NOT EXISTS(SELECT FROM hc_private.case_evidence e WHERE e.evidence_id=x.value::uuid AND e.case_id=cid)) OR (SELECT count(*)<>count(DISTINCT value) FROM jsonb_array_elements_text(input->'concernIds')) OR (SELECT count(*)<>count(DISTINCT value) FROM jsonb_array_elements_text(input->'evidenceIds')) THEN RAISE EXCEPTION 'Invalid references' USING ERRCODE='22023';END IF;
 IF EXISTS(SELECT FROM hc_private.citizen_disputes d WHERE d.case_id=cid AND d.target_kind=kind AND d.target_id=tid) THEN RAISE EXCEPTION 'Already disputed' USING ERRCODE='HC409';END IF;
 INSERT INTO hc_private.citizen_disputes(case_id,actor_id,command_key,target_kind,target_id,version_id,request) VALUES(cid,actor,cmd,kind,tid,vid,input) RETURNING * INTO row;
 PERFORM hc_private.ledger_append(cid,actor,'citizen_dispute_recorded',to_jsonb(row)||jsonb_build_object('status','internal_record_only','governmentAppealFiled',false));
 RETURN to_jsonb(row);
END $$;
GRANT CREATE ON SCHEMA hc_private TO hc_writer;
ALTER FUNCTION hc_private.dispute_read(uuid) OWNER TO hc_writer;
ALTER FUNCTION hc_private.dispute_submit(uuid,uuid,jsonb) OWNER TO hc_writer;
REVOKE CREATE ON SCHEMA hc_private FROM hc_writer;
REVOKE ALL ON FUNCTION hc_private.dispute_read(uuid),hc_private.dispute_submit(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,hc_runtime;
GRANT EXECUTE ON FUNCTION hc_private.dispute_read(uuid),hc_private.dispute_submit(uuid,uuid,jsonb) TO hc_runtime;

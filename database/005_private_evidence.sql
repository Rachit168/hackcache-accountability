CREATE TABLE hc_private.evidence_uploads(id uuid PRIMARY KEY,owner_id uuid NOT NULL,object_path text UNIQUE NOT NULL,display_name text NOT NULL CHECK(length(display_name) BETWEEN 1 AND 240),media_type text NOT NULL,byte_count integer NOT NULL CHECK(byte_count BETWEEN 1 AND 8388608),sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'),uploaded_at timestamptz NOT NULL DEFAULT clock_timestamp(),CHECK(object_path=owner_id::text||'/'||id::text));
CREATE TABLE hc_private.case_evidence(case_id uuid NOT NULL REFERENCES hc_private.cases(id),evidence_id uuid UNIQUE NOT NULL REFERENCES hc_private.evidence_uploads(id),ordinal integer NOT NULL CHECK(ordinal BETWEEN 1 AND 5),attached_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(case_id,ordinal));
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['evidence_uploads','case_evidence'] LOOP
 EXECUTE format('ALTER TABLE hc_private.%I OWNER TO hc_owner',t);
 EXECUTE format('ALTER TABLE hc_private.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE hc_private.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON hc_private.%I FROM PUBLIC,anon,authenticated,hc_runtime,hc_writer',t);
 EXECUTE format('CREATE POLICY evidence_command ON hc_private.%I TO hc_writer USING(true) WITH CHECK(true)',t);
 EXECUTE format('GRANT SELECT,INSERT ON hc_private.%I TO hc_writer',t);
END LOOP; END $$;
CREATE FUNCTION hc_private.evidence_stage(eid uuid,filename text,mime text,bytes integer,digest text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=nullif(current_setting('app.actor_id',true),'')::uuid; prior hc_private.evidence_uploads;
BEGIN
 IF actor IS NULL OR EXISTS(SELECT 1 FROM hc_private.demo_principals WHERE actor_id=actor) THEN RAISE EXCEPTION 'Citizen required' USING ERRCODE='42501'; END IF;
 IF mime NOT IN ('image/jpeg','image/png','application/pdf','text/plain','audio/wav','audio/mpeg','audio/ogg','video/webm','video/mp4') THEN RAISE EXCEPTION 'Unsupported type' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(eid::text,5));
 SELECT * INTO prior FROM hc_private.evidence_uploads WHERE id=eid;
 IF FOUND THEN
  IF prior.owner_id<>actor OR prior.display_name<>filename OR prior.media_type<>mime OR prior.byte_count<>bytes OR prior.sha256<>digest THEN RAISE EXCEPTION 'Upload conflict' USING ERRCODE='HC409'; END IF;
 ELSE INSERT INTO hc_private.evidence_uploads(id,owner_id,object_path,display_name,media_type,byte_count,sha256) VALUES(eid,actor,actor::text||'/'||eid::text,filename,mime,bytes,digest);
 END IF;
 RETURN jsonb_build_object('id',eid);
END $$;
CREATE FUNCTION hc_private.evidence_get(eid uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=nullif(current_setting('app.actor_id',true),'')::uuid; result jsonb;
BEGIN
 IF EXISTS(SELECT 1 FROM hc_private.demo_principals WHERE actor_id=actor AND kind='office') THEN RAISE EXCEPTION 'Denied' USING ERRCODE='42501'; END IF;
 SELECT to_jsonb(e) INTO result FROM hc_private.evidence_uploads e WHERE e.id=eid AND (e.owner_id=actor OR EXISTS(SELECT 1 FROM hc_private.case_evidence x JOIN hc_private.review_assignments a ON a.case_id=x.case_id WHERE x.evidence_id=e.id AND a.reviewer_id=actor));
 IF result IS NULL THEN RAISE EXCEPTION 'Denied' USING ERRCODE='42501'; END IF;RETURN result;
END $$;
ALTER FUNCTION hc_private.submit_complaint(uuid,jsonb) RENAME TO submit_complaint_written;
REVOKE EXECUTE ON FUNCTION hc_private.submit_complaint_written(uuid,jsonb) FROM hc_runtime;
CREATE FUNCTION hc_private.submit_complaint(command_key uuid,body jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=nullif(current_setting('app.actor_id',true),'')::uuid; ids jsonb:=coalesce(body->'evidenceIds','[]'); prior uuid; receipt jsonb; item jsonb; eid uuid; n integer:=0; total bigint; manifest jsonb;
BEGIN
 IF jsonb_typeof(ids)<>'array' OR jsonb_array_length(ids)>5 OR (SELECT count(DISTINCT value) FROM jsonb_array_elements(ids))<>jsonb_array_length(ids) THEN RAISE EXCEPTION 'Invalid evidence set' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(actor::text||command_key::text,1));
 SELECT c.id INTO prior FROM hc_private.cases c WHERE c.actor_id=actor AND c.idempotency_key=command_key;
 IF prior IS NOT NULL AND ids IS DISTINCT FROM coalesce((SELECT jsonb_agg(evidence_id::text ORDER BY ordinal) FROM hc_private.case_evidence WHERE case_id=prior),'[]') THEN RAISE EXCEPTION 'Manifest conflict' USING ERRCODE='HC409'; END IF;
 receipt:=hc_private.submit_complaint_written(command_key,body-'evidenceIds');
 IF prior IS NOT NULL THEN RETURN receipt; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(ids) LOOP
  eid:=(item#>>'{}')::uuid;n:=n+1;
  PERFORM pg_advisory_xact_lock(hashtextextended(eid::text,5));
  IF NOT EXISTS(SELECT 1 FROM hc_private.evidence_uploads WHERE id=eid AND owner_id=actor) OR EXISTS(SELECT 1 FROM hc_private.case_evidence WHERE evidence_id=eid) THEN RAISE EXCEPTION 'Unavailable evidence' USING ERRCODE='42501'; END IF;
  INSERT INTO hc_private.case_evidence(case_id,evidence_id,ordinal) VALUES((receipt->>'id')::uuid,eid,n);
 END LOOP;
 SELECT sum(e.byte_count),jsonb_agg(to_jsonb(e)||jsonb_build_object('ordinal',x.ordinal,'attached_at',x.attached_at) ORDER BY x.ordinal) INTO total,manifest FROM hc_private.case_evidence x JOIN hc_private.evidence_uploads e ON e.id=x.evidence_id WHERE x.case_id=(receipt->>'id')::uuid;
 IF total>31457280 THEN RAISE EXCEPTION 'Evidence size limit' USING ERRCODE='22023'; END IF;
 IF n>0 THEN PERFORM hc_private.ledger_append((receipt->>'id')::uuid,actor,'evidence_manifest',jsonb_build_object('files',manifest)); END IF;
 RETURN receipt;
END $$;
CREATE FUNCTION hc_private.record_bundle(cid uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb; displayed jsonb; files jsonb;
BEGIN
 result:=hc_private.record_read(cid);
 SELECT jsonb_build_object('narrative',o.narrative,'concerns',(SELECT jsonb_agg(jsonb_build_object('type',n.type,'wording',n.wording) ORDER BY n.ordinal) FROM hc_private.concerns n WHERE n.case_id=cid)) INTO displayed FROM hc_private.originals o WHERE o.case_id=cid;
 SELECT coalesce(jsonb_agg(to_jsonb(e)||jsonb_build_object('ordinal',x.ordinal,'attached_at',x.attached_at) ORDER BY x.ordinal),'[]') INTO files FROM hc_private.case_evidence x JOIN hc_private.evidence_uploads e ON e.id=x.evidence_id WHERE x.case_id=cid;
 RETURN result||jsonb_build_object('displayed',displayed,'evidence',files);
END $$;
GRANT CREATE ON SCHEMA hc_private TO hc_writer;
ALTER FUNCTION hc_private.evidence_stage(uuid,text,text,integer,text) OWNER TO hc_writer;
ALTER FUNCTION hc_private.evidence_get(uuid) OWNER TO hc_writer;
ALTER FUNCTION hc_private.submit_complaint(uuid,jsonb) OWNER TO hc_writer;
ALTER FUNCTION hc_private.record_bundle(uuid) OWNER TO hc_writer;
REVOKE CREATE ON SCHEMA hc_private FROM hc_writer;
REVOKE ALL ON FUNCTION hc_private.evidence_stage(uuid,text,text,integer,text),hc_private.evidence_get(uuid),hc_private.submit_complaint(uuid,jsonb),hc_private.record_bundle(uuid) FROM PUBLIC,anon,authenticated,hc_runtime;
GRANT EXECUTE ON FUNCTION hc_private.evidence_stage(uuid,text,text,integer,text),hc_private.evidence_get(uuid),hc_private.submit_complaint(uuid,jsonb),hc_private.record_bundle(uuid) TO hc_runtime;

-- Storage API owns byte operations. INSERT and SELECT only; never overwrite/delete.
INSERT INTO storage.buckets(id,name,public,file_size_limit) VALUES('hc-evidence','hc-evidence',false,8388608);
CREATE FUNCTION public.hc_evidence_access(object_name text,writing boolean) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT NOT EXISTS(SELECT 1 FROM hc_private.demo_principals WHERE actor_id=auth.uid() AND kind='office') AND
 ((split_part(object_name,'/',1)=auth.uid()::text AND (NOT writing OR NOT EXISTS(SELECT 1 FROM hc_private.demo_principals WHERE actor_id=auth.uid()))) OR
 (NOT writing AND EXISTS(SELECT 1 FROM hc_private.evidence_uploads e JOIN hc_private.case_evidence x ON x.evidence_id=e.id JOIN hc_private.review_assignments a ON a.case_id=x.case_id WHERE e.object_path=object_name AND a.reviewer_id=auth.uid())))
$$;
REVOKE ALL ON FUNCTION public.hc_evidence_access(text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hc_evidence_access(text,boolean) TO authenticated;
CREATE POLICY hc_evidence_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='hc-evidence' AND public.hc_evidence_access(name,true));
CREATE POLICY hc_evidence_select ON storage.objects FOR SELECT TO authenticated USING(bucket_id='hc-evidence' AND public.hc_evidence_access(name,false));

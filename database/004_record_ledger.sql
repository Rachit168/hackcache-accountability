-- HC ledger v1: exact payload JSON text plus length-prefixed UTF-8 envelope.
CREATE TABLE hc_private.record_ledger(case_id uuid NOT NULL REFERENCES hc_private.cases(id), sequence integer NOT NULL CHECK(sequence>0), actor_id uuid NOT NULL, recorded_at text NOT NULL, action text NOT NULL, payload_text text NOT NULL, previous_hash text NOT NULL, hash text NOT NULL, PRIMARY KEY(case_id,sequence));
ALTER TABLE hc_private.record_ledger OWNER TO hc_owner;
ALTER TABLE hc_private.record_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE hc_private.record_ledger FORCE ROW LEVEL SECURITY;
REVOKE ALL ON hc_private.record_ledger FROM PUBLIC,anon,authenticated,hc_runtime,hc_writer;
CREATE POLICY ledger_command ON hc_private.record_ledger TO hc_writer USING(true) WITH CHECK(true);
GRANT SELECT,INSERT ON hc_private.record_ledger TO hc_writer;

CREATE FUNCTION hc_private.ledger_frame(parts text[]) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$ SELECT string_agg(octet_length(v)::text || ':' || v,'' ORDER BY n) FROM unnest(parts) WITH ORDINALITY AS p(v,n) $$;
CREATE FUNCTION hc_private.ledger_append(cid uuid, actor uuid, action_name text, payload jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE n integer; prev text; stamp text; body text; digest text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(cid::text,2));
 SELECT sequence,hash INTO n,prev FROM hc_private.record_ledger WHERE case_id=cid ORDER BY sequence DESC LIMIT 1;
 n:=coalesce(n,0)+1; prev:=coalesce(prev,repeat('0',64));
 stamp:=to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'); body:=payload::text;
 digest:=encode(sha256(convert_to(hc_private.ledger_frame(ARRAY['HC-LEDGER-1',cid::text,n::text,actor::text,stamp,action_name,body,prev]),'UTF8')),'hex');
 INSERT INTO hc_private.record_ledger VALUES(cid,n,actor,stamp,action_name,body,prev,digest);
END $$;
CREATE FUNCTION hc_private.ledger_trigger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM hc_private.ledger_append((to_jsonb(NEW)->>CASE WHEN TG_TABLE_NAME='cases' THEN 'id' ELSE 'case_id' END)::uuid,NEW.actor_id,CASE TG_TABLE_NAME WHEN 'cases' THEN 'submitted' WHEN 'outgoing_versions' THEN 'release' ELSE to_jsonb(NEW)->>'action' END,to_jsonb(NEW));
 RETURN NEW;
END $$;
-- Existing records receive one migration-time snapshot. Array order is by UUID,
-- deliberately not a claim about the order of their historical actions.
SELECT hc_private.ledger_append(c.id,c.actor_id,'migration_baseline',jsonb_build_object('provenance','migration-004 snapshot; historical order and cryptographic protection unknown','case',to_jsonb(c),'versions',coalesce((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.id) FROM hc_private.outgoing_versions v WHERE v.case_id=c.id),'[]'),'actions',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM hc_private.workflow_actions a WHERE a.case_id=c.id),'[]'))) FROM hc_private.cases c ORDER BY c.id;
CREATE TRIGGER case_ledger AFTER INSERT ON hc_private.cases FOR EACH ROW EXECUTE FUNCTION hc_private.ledger_trigger();
CREATE TRIGGER version_ledger AFTER INSERT ON hc_private.outgoing_versions FOR EACH ROW EXECUTE FUNCTION hc_private.ledger_trigger();
CREATE TRIGGER action_ledger AFTER INSERT ON hc_private.workflow_actions FOR EACH ROW EXECUTE FUNCTION hc_private.ledger_trigger();
CREATE FUNCTION hc_private.record_read(cid uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=nullif(current_setting('app.actor_id',true),'')::uuid; rows jsonb; head text; total integer;
BEGIN
 IF EXISTS(SELECT 1 FROM hc_private.demo_principals WHERE actor_id=actor AND kind='office') OR NOT EXISTS(SELECT 1 FROM hc_private.cases c WHERE c.id=cid AND (c.actor_id=actor OR EXISTS(SELECT 1 FROM hc_private.review_assignments a WHERE a.case_id=cid AND a.reviewer_id=actor))) THEN RAISE EXCEPTION 'Denied' USING ERRCODE='42501'; END IF;
 SELECT count(*)::int INTO total FROM hc_private.record_ledger WHERE case_id=cid;
 IF total>200 OR (SELECT coalesce(sum(octet_length(payload_text)),0) FROM hc_private.record_ledger WHERE case_id=cid)>8388608 THEN
  RETURN jsonb_build_object('version',1,'caseId',cid,'events','[]'::jsonb,'count',total,'head',null,'incomplete','Verification resource bound reached');
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('caseId',case_id,'sequence',sequence,'actor',actor_id,'time',recorded_at,'action',action,'payloadText',payload_text,'previousHash',previous_hash,'hash',hash) ORDER BY sequence),'[]') INTO rows FROM hc_private.record_ledger WHERE case_id=cid;
 SELECT hash INTO head FROM hc_private.record_ledger WHERE case_id=cid ORDER BY sequence DESC LIMIT 1;
 RETURN jsonb_build_object('version',1,'caseId',cid,'events',rows,'count',total,'head',head);
END $$;
GRANT CREATE ON SCHEMA hc_private TO hc_writer;
ALTER FUNCTION hc_private.ledger_frame(text[]) OWNER TO hc_writer;
ALTER FUNCTION hc_private.ledger_append(uuid,uuid,text,jsonb) OWNER TO hc_writer;
ALTER FUNCTION hc_private.ledger_trigger() OWNER TO hc_writer;
ALTER FUNCTION hc_private.record_read(uuid) OWNER TO hc_writer;
REVOKE CREATE ON SCHEMA hc_private FROM hc_writer;
REVOKE ALL ON FUNCTION hc_private.ledger_frame(text[]),hc_private.ledger_append(uuid,uuid,text,jsonb),hc_private.ledger_trigger(),hc_private.record_read(uuid) FROM PUBLIC,anon,authenticated,hc_runtime;
GRANT EXECUTE ON FUNCTION hc_private.record_read(uuid) TO hc_runtime;

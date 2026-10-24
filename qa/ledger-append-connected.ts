import 'dotenv/config';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {createClient} from '@supabase/supabase-js';
import {configuration} from '../server/config.js';
import {postgresTls} from '../server/postgres-tls.js';
import {caseStore} from '../server/database.js';
import {verifyRecord} from '../domain/record-verification.js';
import {withRaceClients} from './race-cleanup.js';

const config=configuration();
if(!config.ready||process.env.RUN_CONNECTED_CHECKS!=='true'||!process.env.MIGRATION_DATABASE_URL)throw Error('Dedicated connected setup required');
const adminUrl=new URL(process.env.MIGRATION_DATABASE_URL);const projectRef=process.env.SUPABASE_PROJECT_REF;
if(!(adminUrl.hostname==='db.'+projectRef+'.supabase.co'||(adminUrl.hostname.endsWith('.pooler.supabase.com')&&decodeURIComponent(adminUrl.username)==='postgres.'+projectRef)))throw Error('Audit login must target the dedicated project');
const options={ssl:postgresTls(),connectionTimeoutMillis:8000,statement_timeout:10000};
const runtime=new pg.Pool({connectionString:config.databaseUrl,max:2,...options});
const audit=new pg.Pool({connectionString:process.env.MIGRATION_DATABASE_URL,max:1,...options});
let stage='private managed session refresh';
try{
 const session=JSON.parse(await fs.readFile('.cache/t04-reviewer.json','utf8'));
 const auth=createClient(config.url!,config.key!,{auth:{persistSession:false,autoRefreshToken:false}});
 const refreshed=await auth.auth.setSession(session);assert.ifError(refreshed.error);
 const identity=await auth.auth.getUser(refreshed.data.session!.access_token);assert.ifError(identity.error);const actor=identity.data.user!.id;
 stage='fixture read';
 const {id}=JSON.parse(await fs.readFile('.cache/t04-case.json','utf8'));
 const store=caseStore(runtime);const view=await store.workflowRead(actor,id);assert.equal(view.kind,'reviewer');
 const before=await store.recordBundle(actor,id);assert.equal((await verifyRecord(before)).valid,true);
 const content=view.versions[0].content;
 stage='distinct command race';
 const evidence=await withRaceClients(()=>runtime.connect(),async(first,second,observe)=>{
  const pids=await Promise.all([first.query('SELECT pg_backend_pid() pid'),second.query('SELECT pg_backend_pid() pid')]);const a=pids[0].rows[0].pid,b=pids[1].rows[0].pid;assert.notEqual(a,b);
  for(const client of [first,second]){await client.query('BEGIN');await client.query("SELECT set_config('app.actor_id',$1,true)",[actor]);}
  const sql='SELECT hc_private.workflow_commit($1::uuid,$2::uuid,$3::text,$4::jsonb) value';
  const keyA=randomUUID(),keyB=randomUUID();assert.notEqual(keyA,keyB);
  const one=await first.query(sql,[id,keyA,'release',JSON.stringify({...content,narrative:'Fictional distinct concurrent append A',reason:'Dedicated concurrency fixture.'})]);
  const pending=second.query(sql,[id,keyB,'release',JSON.stringify({...content,narrative:'Fictional distinct concurrent append B',reason:'Dedicated concurrency fixture.'})]);observe(second,pending);
  let blocked=false;const deadline=Date.now()+4000;
  while(Date.now()<deadline){const r=await audit.query('SELECT $2::int=ANY(pg_blocking_pids($1::int)) blocked',[b,a]);if(r.rows[0].blocked){blocked=true;break;}await new Promise(r=>setTimeout(r,40));}
  assert.ok(blocked);await first.query('COMMIT');const two=await pending;await second.query('COMMIT');assert.notEqual(one.rows[0].value.id,two.rows[0].value.id);
  return {backendPids:[a,b],observedBlocking:blocked};
 });
 stage='post-commit independent verification';
 const after=await store.recordBundle(actor,id);assert.equal(after.count,before.count+2);assert.equal((await verifyRecord(after)).valid,true);assert.deepEqual(after.events.slice(-2).map((e:{sequence:number})=>e.sequence),[before.count+1,before.count+2]);
 console.log('DISTINCT_LEDGER_APPENDS_PASSED '+JSON.stringify({...evidence,additionalOrderedEvents:2,independentChainVerification:true}));
}catch(e){console.error('DISTINCT_LEDGER_APPENDS_FAILED at '+stage,e instanceof assert.AssertionError?e.message:'Private fixture, connection or cleanup failure');process.exitCode=1;}finally{await runtime.end();await audit.end();}

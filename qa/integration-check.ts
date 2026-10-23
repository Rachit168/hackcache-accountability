import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import { createClient } from '@supabase/supabase-js';
import { configuration } from '../server/config.js';
import { caseStore,transaction } from '../server/database.js';
import { createApp } from '../server/app.js';
import { complaintSchema } from '../domain/complaint.js';
import { firstSubmissionRace } from './first-submission-race.js';
import { inspectPermissions,checkPrivateSchemaExposure } from './connected-permissions.js';
import { checkPolicyBehavior } from './policy-behavior.js';
const config=configuration();
if(!config.ready||process.env.RUN_CONNECTED_CHECKS!=='true'||!process.env.MIGRATION_DATABASE_URL){console.log('CONNECTED_CHECKS_NOT_RUN: dedicated Supabase configuration, migration audit credentials and RUN_CONNECTED_CHECKS=true required. No fake identity/storage substitute used.');process.exitCode=2;}
else {
 const adminUrl=new URL(process.env.MIGRATION_DATABASE_URL!);
 const ref=process.env.SUPABASE_PROJECT_REF;
 const adminUser=decodeURIComponent(adminUrl.username);
 if(adminUser.startsWith('hc_runtime')||!(adminUrl.hostname===`db.${ref}.supabase.co`||(adminUrl.hostname.endsWith('.pooler.supabase.com')&&adminUser===`postgres.${ref}`))) throw new Error('Audit credentials must target the confirmed dedicated project and differ from runtime.');
 const connectionOptions={ssl:{rejectUnauthorized:true},connectionTimeoutMillis:5000,statement_timeout:10000,query_timeout:12000};
 const pool=new pg.Pool({connectionString:config.databaseUrl,max:1,...connectionOptions});
 const racePool=new pg.Pool({connectionString:config.databaseUrl,max:2,...connectionOptions});
 const audit=new pg.Pool({connectionString:adminUrl.toString(),max:1,...connectionOptions});
 let stage='permission audit';
 try {
  await inspectPermissions(pool,audit);
  stage='private schema exposure';
  await checkPrivateSchemaExposure(config.url!,config.key!);
  stage='real managed identities and API readback';
  const makeAuth=()=>createClient(config.url!,config.key!,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(8000)})}});
  const a=makeAuth(),b=makeAuth();const sa=await a.auth.signInAnonymously(),sb=await b.auth.signInAnonymously();assert.ifError(sa.error);assert.ifError(sb.error);
  const ta=sa.data.session!.access_token,tb=sb.data.session!.access_token,actor=sa.data.user!.id;assert.notEqual(actor,sb.data.user!.id);
  const app=createApp({config,store:caseStore(pool),verify:async token=>{const {data,error}=await a.auth.getUser(token);return error?null:data.user?.id??null;}});
  const payload={narrative:`Fictional integration case ${randomUUID()}`,office:'SAMPLE_MUNICIPAL_DESK',category:'SAMPLE_MUNICIPAL_SERVICE',declaration:true,concerns:Array.from({length:4},(_,i)=>({type:i===3?'conduct':'service',wording:`Fictional concern ${i+1}`}))};
  const key=randomUUID();
  const submit=()=>request(app).post('/api/complaints').auth(ta,{type:'bearer'}).set('Idempotency-Key',key).send(payload);
  const created=await submit();assert.equal(created.status,201);const id=created.body.id;
  const read=await request(app).get(`/api/complaints/${id}`).auth(ta,{type:'bearer'});assert.equal(read.status,200);assert.equal(read.body.narrative,payload.narrative);assert.deepEqual(read.body.concerns,payload.concerns);
  assert.equal((await request(app).get(`/api/complaints/${id}`).auth(tb,{type:'bearer'})).status,404);
  assert.equal((await request(app).get(`/api/complaints/${randomUUID()}`).auth(ta,{type:'bearer'})).status,404);
  assert.equal((await request(app).get(`/api/complaints/${id}`)).status,401);
  assert.equal((await request(app).get(`/api/complaints/${id}`).auth('forged-token',{type:'bearer'})).status,401);
  assert.equal((await request(app).post('/api/complaints').auth(ta,{type:'bearer'}).set('Idempotency-Key',randomUUID()).send({...payload,workspace:randomUUID()})).status,400);
  for(const field of ['actor','actor_id','role','userId']) assert.equal((await request(app).post('/api/complaints').auth(ta,{type:'bearer'}).set('Idempotency-Key',randomUUID()).send({...payload,[field]:randomUUID()})).status,400);
  stage='row-security behavior under non-owner writer';
  await checkPolicyBehavior(audit,actor,sb.data.user!.id,complaintSchema.parse(payload));
  stage='runtime commands with mismatched membership context';
  const workspaceA=await transaction(pool,actor,async(_client,workspace)=>workspace);
  await transaction(pool,sb.data.user!.id,async client=>{
    await client.query("SELECT set_config('app.workspace_id',$1,true)",[workspaceA]);
    for(const [sql,values] of [
      ['SELECT hc_private.read_complaint($1::uuid)',[id]],
      ['SELECT hc_private.submit_complaint($1::uuid,$2::jsonb)',[randomUUID(),JSON.stringify(payload)]],
    ] as [string,string[]][]){
      await client.query('SAVEPOINT command_denial');
      try {await assert.rejects(client.query(sql,values),(error:unknown)=>(error as {code:string}).code==='42501');}
      finally {await client.query('ROLLBACK TO SAVEPOINT command_denial');}
    }
  });
  // Sequential retries test existing-receipt idempotency, not concurrency.
  for(let retry=0;retry<2;retry++){const d=await submit();assert.equal(d.status,201);assert.equal(d.body.id,id);}
  assert.equal((await request(app).post('/api/complaints').auth(ta,{type:'bearer'}).set('Idempotency-Key',key).send({...payload,narrative:'Changed content'})).status,409);
  const counts=await audit.query('SELECT (SELECT count(*)::int FROM hc_private.cases WHERE id=$1) AS cases,(SELECT count(*)::int FROM hc_private.originals WHERE case_id=$1) AS originals,(SELECT count(*)::int FROM hc_private.concerns WHERE case_id=$1) AS concerns,(SELECT count(*)::int FROM hc_private.events WHERE case_id=$1) AS events',[id]);assert.deepEqual(counts.rows[0],{cases:1,originals:1,concerns:4,events:1});
  stage='independent-connection competing first submissions';
  const race=await firstSubmissionRace(racePool,audit,actor,complaintSchema.parse(payload));
  assert.equal((await request(app).post('/api/complaints').auth(ta,{type:'bearer'}).set('Idempotency-Key',race.key).send({...payload,narrative:'Changed racing content'})).status,409);
  stage='rollback and single-connection context cleanup';
  const failedKey=randomUUID();
  // Invalid second concern reaches the SQL loop AFTER case and original INSERTs.
  await assert.rejects(transaction(pool,actor,async client=>client.query('SELECT hc_private.submit_complaint($1,$2::jsonb)',[failedKey,JSON.stringify({...payload,concerns:[payload.concerns[0],{type:'invalid',wording:'force bounded validation failure'}]})])));
  const partial=await audit.query('SELECT count(*)::int AS count FROM hc_private.cases WHERE actor_id=$1 AND idempotency_key=$2',[actor,failedKey]);assert.equal(partial.rows[0].count,0);
  for(const name of ['app.actor_id','app.workspace_id']) {const context=await pool.query("SELECT nullif(current_setting($1,true),'') AS value",[name]);assert.equal(context.rows[0].value,null);}
  const wa=await transaction(pool,actor,async(_client,w)=>w),wa2=await transaction(pool,actor,async(_client,w)=>w);assert.equal(wa,wa2);
  await assert.rejects(transaction(pool,actor,async()=>{throw new Error('controlled rollback');}));
  for(const name of ['app.actor_id','app.workspace_id']) {const context=await pool.query("SELECT nullif(current_setting($1,true),'') AS value",[name]);assert.equal(context.rows[0].value,null);}
  console.log('CONNECTED_SELF_CHECKS_PASSED: real A/B identities; persistent four-concern readback; denied forged/missing identity and workspace; sequential retries; independent backend first-submission race with observed blocking; changed payload conflict; atomic rollback; runtime SELECT/INSERT/UPDATE/DELETE denial; permission catalog audit; private schema profile exclusion; single-connection context reset. Browser journey is NOT covered by this runner.');
  console.log('Retained fictional test-owned record:',id,'Browser smoke is a separate check.');
 }catch {console.error(`CONNECTED_CHECKS_FAILED at ${stage}: inspect dedicated setup/checks privately. No acceptance claimed.`);process.exitCode=1;}finally{await pool.end();await racePool.end();await audit.end();}
}

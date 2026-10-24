import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import pg from 'pg';
import request from 'supertest';
import {createClient} from '@supabase/supabase-js';
import {configuration} from '../server/config.js';
import {postgresTls} from '../server/postgres-tls.js';
import {caseStore} from '../server/database.js';
import {createApp} from '../server/app.js';
import {validateReport} from '../domain/intake-ai.js';
import {fictionalPdf} from './intake-fixtures.js';
const config=configuration();
if(!config.ready||process.env.RUN_CONNECTED_CHECKS!=='true'||!process.env.OPENROUTER_API_KEY)throw Error('Dedicated connected/provider configuration required.');
const pool=new pg.Pool({connectionString:config.databaseUrl,ssl:postgresTls(),connectionTimeoutMillis:8000});
let stage='managed identity';
try{
 const auth=createClient(config.url!,config.key!,{auth:{persistSession:false,autoRefreshToken:false}});
 const session=await auth.auth.signInAnonymously();assert.ifError(session.error);const token=session.data.session!.access_token;
 const app=createApp({config,store:caseStore(pool),verify:async t=>{const r=await auth.auth.getUser(t);return r.error?null:r.data.user?.id??null;}});
 const text='Fictional demonstration only. The sample counter was closed on Monday. Please publish the opening hours.';
 const files=[{name:'fictional-note.txt',bytes:Buffer.from(text),kind:'text/plain',location:'document text'}, {name:'fictional-page.pdf',bytes:fictionalPdf(text),kind:'application/pdf',location:'page 1'}, {name:'fictional-image.png',bytes:await fs.readFile('.cache/b02-image-text.png'),kind:'image/png',location:'provider image-text extraction'}];
 for(const file of files.filter(f=>!process.argv.includes('--image-only')||f.kind==='image/png')){
  stage=file.name+' upload';
  const uploaded=await request(app).post('/api/evidence').auth(token,{type:'bearer'}).set('Idempotency-Key',randomUUID()).set('X-Evidence-Name',file.name).set('Content-Type','application/octet-stream').send(file.bytes);assert.equal(uploaded.status,201);
  stage=file.name+' live processing';
  const key=randomUUID();const send=()=>request(app).post('/api/intake/drafts').auth(token,{type:'bearer'}).set('Idempotency-Key',key).send({text:'',evidenceIds:[uploaded.body.id],mode:'live'});
  let r=await send();if(r.body.error==='INVALID_PROVIDER_REPORT'){console.log('LIVE_FORMAT_REJECTED_INVALID_REPORT: '+file.kind+'; retrying unchanged command once');r=await send();}
  assert.equal(r.status,201,String(r.body.error));const draft=r.body.body;validateReport(draft.report,draft.sources);assert.equal(draft.provenance.mode,'live');assert.equal(draft.sources[0].kind,file.kind);assert.ok(draft.sources[0].segments[0].location.startsWith(file.location));assert.match(draft.sources[0].segments[0].text,/sample counter/i);assert.match(draft.sources[0].segments[0].text,/Monday/);
  console.log('LIVE_FORMAT_PASSED: '+file.kind+' authorized bytes → retained extraction → validated report');
 }
 console.log('INTAKE_FORMATS_CONNECTED_PASSED: selected private source formats, real managed identity and live OpenRouter processing.');
}catch(e){console.error('INTAKE_FORMATS_CONNECTED_FAILED at '+stage,e instanceof assert.AssertionError?e.message:'Private connection/provider failure');process.exitCode=1;}finally{await pool.end();}

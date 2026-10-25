import {it,expect,vi} from 'vitest';import request from 'supertest';import {randomUUID} from 'node:crypto';
import {createApp} from '../server/app';import {fixtureText} from '../domain/intake-ai';
it('production denies anonymous and citizen fixtures, including cached prepared results',async()=>{
 const actor=randomUUID(),find=vi.fn(async()=>({id:'cached',body:{}}));const config={ready:true,url:'fixture',key:'fixture',databaseUrl:'fixture'};
 const store={read:async()=>null,submit:async()=>{throw Error();},intakeCommand:find};const app=createApp({config,store,verify:async()=>actor});
 expect((await request(app).get('/api/fixtures/intake.wav')).status).toBe(401);
 expect((await request(app).get('/api/fixtures/intake.wav').auth('fixture',{type:'bearer'})).status).toBe(404);
 expect((await request(app).post('/api/intake/drafts').auth('fixture',{type:'bearer'}).set('Idempotency-Key',randomUUID()).send({text:fixtureText,evidenceIds:[],mode:'prepared'})).status).toBe(403);expect(find).not.toHaveBeenCalled();
});
it('explicit local harness capability permits only its named developer actor',async()=>{
 const developer=randomUUID();const config={ready:true,url:'fixture',key:'fixture',databaseUrl:'fixture'};
 const app=createApp({config,developerFixtureAccess:a=>a===developer,verify:async t=>t==='developer'?developer:randomUUID(),store:{read:async()=>null,submit:async()=>{throw Error();},intakeCommand:async(_a,op,_k,body)=>op==='find'?null:{id:'fixture',body}}});
 expect((await request(app).get('/api/fixtures/intake.wav').auth('citizen',{type:'bearer'})).status).toBe(404);
 expect((await request(app).get('/api/fixtures/intake.wav').auth('developer',{type:'bearer'})).status).toBe(200);
 expect((await request(app).post('/api/intake/drafts').auth('developer',{type:'bearer'}).set('Idempotency-Key',randomUUID()).send({text:fixtureText,evidenceIds:[],mode:'prepared'})).status).toBe(201);
});

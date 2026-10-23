import { describe,it,expect,vi } from 'vitest';
import request from 'supertest';
import { complaintSchema } from '../domain/complaint.js';
import { configuration } from '../server/config.js';
import { createApp } from '../server/app.js';
const actor='10000000-0000-4000-8000-000000000001';
const key='20000000-0000-4000-8000-000000000001';
const payload={narrative:'Fictional permit inquiry and conduct concern.',office:'SAMPLE_MUNICIPAL_DESK',category:'SAMPLE_MUNICIPAL_SERVICE',concerns:Array.from({length:4},(_,i)=>({type:i===3?'conduct':'service',wording:`Sample concern ${i+1}`})),declaration:true};
describe('shared validation',()=>{
 it('accepts four manually confirmed concerns',()=>expect(complaintSchema.safeParse(payload).success).toBe(true));
 it('rejects actor/workspace/role injection',()=>{for(const field of ['actor','workspace','role'])expect(complaintSchema.safeParse({...payload,[field]:'forged'}).success).toBe(false);});
 it('enforces narrative limits, concern type and declaration',()=>{for(const candidate of [{...payload,narrative:'x'.repeat(12001)},{...payload,concerns:[]},{...payload,declaration:false},{...payload,concerns:[{type:'guilty',wording:'bad'}]}])expect(complaintSchema.safeParse(candidate).success).toBe(false);});
});
describe('configuration and API boundary (local dependency stubs; not connected proof)',()=>{
 it('fails closed without dedicated configuration',async()=>{const app=createApp({config:configuration({})});expect((await request(app).get('/api/config')).body.ready).toBe(false);expect((await request(app).post('/api/complaints').send(payload)).status).toBe(401);expect((await request(app).post('/api/complaints').auth('fake',{type:'bearer'}).send(payload)).status).toBe(503);});
 it('does not accept admin login as runtime configuration',()=>expect(configuration({SUPABASE_URL:'https://example.supabase.co',SUPABASE_PROJECT_REF:'example',DEDICATED_PROJECT_CONFIRM:'example',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_example',DATABASE_URL:'postgresql://postgres:fake@db.example.supabase.co/postgres'}).ready).toBe(false));
 function fixture(){const store={submit:vi.fn().mockResolvedValue({id:key,status:'submitted',submittedAt:'2026-10-23T00:00:00Z'}),read:vi.fn().mockResolvedValue(null)};const verify=vi.fn(async token=>token==='valid'?actor:null);const app=createApp({config:{ready:true,url:undefined,key:undefined,databaseUrl:undefined},store,verify});return{app,store,verify};}
 it('rejects invalid tokens before any database command',async()=>{const {app,store}=fixture();expect((await request(app).post('/api/complaints').auth('forged',{type:'bearer'}).send(payload)).status).toBe(401);expect(store.submit).not.toHaveBeenCalled();});
 it('passes only verified actor and validated input into commands',async()=>{const {app,store}=fixture();expect((await request(app).post('/api/complaints').auth('valid',{type:'bearer'}).set('Idempotency-Key',key).send(payload)).status).toBe(201);expect(store.submit).toHaveBeenCalledWith(actor,key,payload);});
 it('rejects extra workspace fields before persistence',async()=>{const {app,store}=fixture();expect((await request(app).post('/api/complaints').auth('valid',{type:'bearer'}).set('Idempotency-Key',key).send({...payload,workspace:key})).status).toBe(400);expect(store.submit).not.toHaveBeenCalled();});
 it('does not expose database errors or a submitted-history mutation route',async()=>{const {app,store}=fixture();store.submit.mockRejectedValue({code:'XX000',message:'private-secret'});const r=await request(app).post('/api/complaints').auth('valid',{type:'bearer'}).set('Idempotency-Key',key).send(payload);expect(r.status).toBe(503);expect(r.text).not.toContain('private-secret');expect((await request(app).delete(`/api/complaints/${key}`).auth('valid',{type:'bearer'})).status).toBe(404);});
 it('returns a clear idempotency conflict',async()=>{const {app,store}=fixture();store.submit.mockRejectedValue({code:'HC409'});expect((await request(app).post('/api/complaints').auth('valid',{type:'bearer'}).set('Idempotency-Key',key).send(payload)).status).toBe(409);});
 it('uses indistinguishable not-found response for inaccessible cases',async()=>{const {app}=fixture();expect((await request(app).get(`/api/complaints/${key}`).auth('valid',{type:'bearer'})).status).toBe(404);});
});

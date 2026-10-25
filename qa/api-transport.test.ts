import {it,expect,vi} from 'vitest';
import request from 'supertest';
import {authenticatedFetch} from '../web/api-transport';
import {operatorApiFor} from '../web/operator-api';
import {createApp} from '../server/app';
import {workflowLoadMessage} from '../web/workflow-load';
import type {SupabaseClient} from '@supabase/supabase-js';
const actor='10000000-0000-4000-8000-000000000001';
const staff={auth:{getSession:async()=>({data:{session:{access_token:'fictional-office-token'}},error:null})}} as unknown as Pick<SupabaseClient,'auth'>;
it('real operator-to-shared-transport composition emits one office credential and does not read citizen auth',async()=>{
 const citizen=vi.fn(async()=>'fictional-citizen-token');let count=0;let office=false;
 const send:typeof fetch=async(_url,init)=>{const value=new Headers(init?.headers).get('authorization')??'';count=(value.match(/Bearer /g)??[]).length;office=value==='Bearer fictional-office-token';return Response.json({ok:true});};
 const transport=async<T>(path:string,init?:RequestInit)=>(await (await authenticatedFetch(path,init??{},citizen,send)).json()) as T;
 await operatorApiFor(staff,transport)('/workflow',{headers:{AuThOrIzAtIoN:'Bearer forged-caller','Idempotency-Key':'unchanged'}});
 expect(count).toBe(1);expect(office).toBe(true);expect(citizen).not.toHaveBeenCalled();
});
it('supports Headers and tuple inputs, keeps binary type and command key, without mutating input',async()=>{
 for(const headers of [new Headers({'Content-Type':'application/octet-stream','Idempotency-Key':'same'}),[['content-type','application/octet-stream'],['idempotency-key','same']] as [string,string][]]){
  const send:typeof fetch=async(_url,init)=>{const h=new Headers(init?.headers);expect(h.get('content-type')).toBe('application/octet-stream');expect(h.get('idempotency-key')).toBe('same');expect(h.get('authorization')).toBe('Bearer fictional-citizen-token');return Response.json({});};
  await authenticatedFetch('/evidence',{headers},async()=>'fictional-citizen-token',send);expect(new Headers(headers).has('authorization')).toBe(false);
 }
});
it('composed office request passes real middleware while missing, duplicate and forged credentials remain rejected',async()=>{
 const app=createApp({config:{ready:true,url:undefined,key:undefined,databaseUrl:undefined},store:{read:async()=>null,submit:async()=>{throw Error();},workflowRead:async()=>({kind:'office',cases:[]})} as any,verify:async t=>t==='fictional-office-token'?actor:null});
 const send:typeof fetch=async(url,init)=>{const r=await request(app).get(String(url)).set(Object.fromEntries(new Headers(init?.headers).entries()));return Response.json(r.body,{status:r.status});};
 const transport=async<T>(path:string,init?:RequestInit)=>{const r=await authenticatedFetch(path,init??{},async()=>'fictional-citizen-token',send);expect(r.status).toBe(200);return await r.json() as T;};
 await operatorApiFor(staff,transport)('/workflow');
 for(const value of ['', 'Bearer expired','Bearer forged','Bearer first, Bearer second','Basic example'])expect((await request(app).get('/api/workflow').set('Authorization',value)).status).toBe(401);
});
it('citizen credentials cannot open the staff queue and errors distinguish authentication, permission and outage',async()=>{
 const app=createApp({config:{ready:true,url:undefined,key:undefined,databaseUrl:undefined},store:{workflowRead:async()=>({kind:'citizen',cases:[]})} as any,verify:async()=>actor});
 expect((await request(app).get('/api/workflow').set('Authorization','Bearer fictional-citizen')).status).toBe(403);
 for(const language of ['en','hi'] as const){const messages=[{authCode:'NO_SESSION'},{status:401},{status:403},{status:503}].map(e=>workflowLoadMessage(e,language));expect(new Set(messages).size).toBe(4);}
});

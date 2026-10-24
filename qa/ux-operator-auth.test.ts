import {describe,it,expect,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {operatorApiFor} from '../web/operator-api';

type Captured={path:string;init?:RequestInit};
function mockStaff(token:string|null,error:unknown=null):Pick<SupabaseClient,'auth'>{
 return {auth:{getSession:async()=>({data:{session:token?{access_token:token}:null},error})}} as unknown as Pick<SupabaseClient,'auth'>;
}
describe('staff API credential isolation',()=>{
 it('rejects calls without a staff client, not falling back to citizen credentials',async()=>{
  const request=vi.fn(async <T=unknown>()=>({ok:true}) as T);
  await expect(operatorApiFor(undefined,request)('/workflow')).rejects.toThrow('Operator session unavailable');
  expect(request).not.toHaveBeenCalled();
 });
 it('rejects a staff client with no valid staff session',async()=>{
  const request=vi.fn(async <T=unknown>()=>({ok:true}) as T);
  await expect(operatorApiFor(mockStaff(null),request)('/workflow')).rejects.toThrow('Operator authentication required');
  expect(request).not.toHaveBeenCalled();
 });
 it('rejects staff refresh/auth errors rather than reusing citizen state',async()=>{
  const request=vi.fn(async <T=unknown>()=>({ok:true}) as T);
  await expect(operatorApiFor(mockStaff('stale-token',Error('expired')),request)('/workflow')).rejects.toThrow('Operator authentication required');
  expect(request).not.toHaveBeenCalled();
 });
 it('uses the provisioned staff token even when caller forges an Authorization header',async()=>{
  let seen:Captured|undefined;
  const request=async <T=unknown>(path:string,init?:RequestInit)=>{seen={path,init};return {ok:true} as T;};
  const result=await operatorApiFor(mockStaff('operator-token'),request)<{ok:boolean}>('/workflow/abc',{method:'POST',headers:{'Authorization':'Bearer citizen-token','Idempotency-Key':'same-command'},body:'{"test":true}'});
  expect(result).toEqual({ok:true});
  expect(seen?.path).toBe('/workflow/abc');
  expect(seen?.init?.method).toBe('POST');
  expect(seen?.init?.body).toBe('{"test":true}');
  const headers=new Headers(seen?.init?.headers);
  expect(headers.get('Authorization')).toBe('Bearer operator-token');
  expect(headers.get('Idempotency-Key')).toBe('same-command');
 });
 it('does not modify caller-owned headers',async()=>{
  const input={'Authorization':'Bearer spoof','X-Test':'unchanged'};
  const request=async <T=unknown>()=>({ok:true}) as T;
  await operatorApiFor(mockStaff('operator-token'),request)('/workflow',{headers:input});
  expect(input.Authorization).toBe('Bearer spoof');
  expect(input['X-Test']).toBe('unchanged');
 });
});

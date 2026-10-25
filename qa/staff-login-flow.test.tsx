import React from 'react';
import {describe,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {signInStaff,verifyStaffSession,authorizedStaffKind} from '../web/staff-login-state';
import {StaffRoleSummary,isAuthorizedRoleQueue} from '../web/staff-role-summary';
import {readFileSync} from 'node:fs';

function auth(credentialOk=true){
 const signInWithPassword=vi.fn(async(args:{email:string;password:string})=>credentialOk
  ?{data:{session:{access_token:'signed-in-test-token'}},error:null}
  :{data:{session:null},error:{message:'Invalid credentials',status:400}});
 const getSession=vi.fn(async()=>({data:{session:{access_token:'signed-in-test-token'}},error:null}));
 const signOut=vi.fn(async()=>({error:null}));
 return {signInWithPassword,getSession,signOut};
}

describe('email/password staff authorization boundary',()=>{
 it.each(['reviewer','office'] as const)('accepts a verified %s only when the server returns that role',async kind=>{
  const a=auth();
  const queue=vi.fn(async()=>({kind,cases:[]}));
  const result=await signInStaff(a as never,'  Staff@Demo.Example ', 'long private password',queue);
  expect(result).toEqual({status:'authorized',kind});
  expect(a.signInWithPassword).toHaveBeenCalledWith({email:'Staff@Demo.Example',password:'long private password'});
  expect(queue).toHaveBeenCalledOnce();
  expect(a.signOut).not.toHaveBeenCalled();
 });
 it('never grants staff role just because email/password are valid',async()=>{
  const a=auth();
  const queue=vi.fn(async()=>({kind:'citizen',cases:[]}));
  expect(await signInStaff(a as never,'staff@example.com','correct password',queue)).toEqual({status:'not-provisioned'});
  expect(a.signOut).toHaveBeenCalledOnce();
 });
 it('does not contact the privileged route for invalid email/password',async()=>{
  const a=auth(false),queue=vi.fn(async()=>({kind:'reviewer'}));
  expect(await signInStaff(a as never,'wrong@example.com','bad',queue)).toEqual({status:'invalid-credentials'});
  expect(queue).not.toHaveBeenCalled();
 });
 it('does not allow forged role text, metadata or an unrelated role',async()=>{
  for(const value of [null,{},'reviewer',{kind:'citizen'},{role:'reviewer'},{kind:'admin'},{kind:'reviewer ',user_metadata:{role:'reviewer'}}]){
   expect(authorizedStaffKind(value)).toBeNull();
  }
 });
 it('preserves a valid session when authorization network is unavailable and safely permits retry',async()=>{
  const a=auth(),read=vi.fn().mockRejectedValueOnce(Object.assign(Error('offline'),{status:503})).mockResolvedValueOnce({kind:'office',cases:[]});
  expect(await signInStaff(a as never,'office@example.com','correct',read)).toEqual({status:'service-unavailable'});
  expect(a.signOut).not.toHaveBeenCalled();
  expect(await verifyStaffSession(a as never,read)).toEqual({status:'authorized',kind:'office'});
  expect(a.signInWithPassword).toHaveBeenCalledTimes(1);
  expect(read).toHaveBeenCalledTimes(2);
 });
 it('rejects 401 expired session and 403 unprovisioned identity without persisting a staff login',async()=>{
  for(const [status,expected] of [[401,'session-missing'],[403,'not-provisioned']] as const){
   const a=auth();
   expect(await verifyStaffSession(a as never,async()=>{throw Object.assign(Error('denied'),{status});})).toEqual({status:expected});
   expect(a.signOut).toHaveBeenCalledOnce();
  }
 });
 it('distinguishes a retryable Supabase failure from incorrect credentials',async()=>{
  const a=auth();
  a.signInWithPassword.mockResolvedValueOnce({data:{session:null},error:{status:503,message:'server unavailable'}});
  expect(await signInStaff(a as never,'office@example.com','password',async()=>({kind:'office'}))).toEqual({status:'service-unavailable'});
 });
});

describe('honest staff workspace role UX',()=>{
 it.each(['reviewer','office'] as const)('renders role %s only from an authorized queue',kind=>{
  const html=renderToStaticMarkup(<StaffRoleSummary view={{kind,cases:[]}} language="en"/>);
  expect(html).toContain(kind==='reviewer'?'Reviewer workspace':'Office workspace');
  expect(html).toContain(kind==='reviewer'?'no case has been assigned':'Cases appear only after a reviewer releases');
  expect(html).not.toContain('Total platform');
  expect(html).not.toContain('deadline');
  expect(html).toContain('Server-authorized staff role');
 });
 it('rejects nonstaff queue and does not invent a role without a case list',()=>{
  expect(isAuthorizedRoleQueue({kind:'reviewer'})).toBe(false);
  expect(renderToStaticMarkup(<StaffRoleSummary view={{kind:'citizen',cases:[]}} language="en"/>)).toBe('');
 });
 it('has independent bilingual account contexts and no browser-controlled role selection',()=>{
  const portal=readFileSync(new URL('../web/staff-portal.tsx',import.meta.url),'utf8');
  expect(portal).toContain('signInStaff(client.auth,email,password,()=>api');
  expect(portal).toContain('Retry staff role check');
  expect(portal).toContain('this account has no authorized reviewer or office role');
  expect(portal).not.toContain('setRole(');
  const html=renderToStaticMarkup(<StaffRoleSummary view={{kind:'reviewer',cases:[]}} language="hi"/>);
  expect(html).toContain('समीक्षक कार्यक्षेत्र');
 });
});

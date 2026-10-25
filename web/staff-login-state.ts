import type {SupabaseClient} from '@supabase/supabase-js';

export type StaffKind='reviewer'|'office';
export type StaffLoginResult=
 |{status:'authorized';kind:StaffKind}
 |{status:'invalid-credentials'|'not-provisioned'|'service-unavailable'|'session-missing'};

type Auth=Pick<SupabaseClient['auth'],'signInWithPassword'|'getSession'|'signOut'>;

export function authorizedStaffKind(value:unknown):StaffKind|null{
 if(!value||typeof value!=='object')return null;
 const kind=(value as {kind?:unknown}).kind;
 return kind==='reviewer'||kind==='office'?kind:null;
}

/** Authentication proves possession of valid credentials only.
 * The server-side, scoped /workflow response determines the staff role.
 * Do not derive a role from the email, local state, JWT metadata or UI controls.
 */
export async function verifyStaffSession(
 auth:Auth,
 readScopedQueue:()=>Promise<unknown>,
):Promise<StaffLoginResult>{
 try{
  const {data,error}=await auth.getSession();
  if(error||!data.session?.access_token)return {status:'session-missing'};
  const view=await readScopedQueue();
  const kind=authorizedStaffKind(view);
  if(kind)return {status:'authorized',kind};
  // A valid identity lacking an authorized staff queue must never linger
  // as an apparent staff login.
  try{await auth.signOut();}catch{/* Server still denies privileged routes. */}
  return {status:'not-provisioned'};
 }catch(error){
  const status=(error as {status?:unknown})?.status;
  if(status===401||status===403){
   try{await auth.signOut();}catch{/* Deny UI regardless. */}
   return {status:'not-provisioned'};
  }
  return {status:'service-unavailable'};
 }
}

export async function signInStaff(
 auth:Auth,email:string,password:string,readScopedQueue:()=>Promise<unknown>,
):Promise<StaffLoginResult>{
 if(!email.trim()||!password)return {status:'invalid-credentials'};
 try{
  const {data,error}=await auth.signInWithPassword({email:email.trim(),password});
  if(error||!data.session)return {status:'invalid-credentials'};
 }catch{
  return {status:'invalid-credentials'};
 }
 return verifyStaffSession(auth,readScopedQueue);
}

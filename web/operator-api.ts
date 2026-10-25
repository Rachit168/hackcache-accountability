import type {SupabaseClient} from '@supabase/supabase-js';
type Api=<T=unknown>(path:string,init?:RequestInit)=>Promise<T>;

// Fail closed. Neither a missing nor expired operator identity may fall through to a citizen token.
// Header construction is canonical: caller-supplied Authorization cannot override staff identity.
export function operatorApiFor(client:Pick<SupabaseClient,'auth'>|undefined,request:Api):Api{
 return async <T=unknown>(path:string,init:RequestInit={})=>{
  if(!client)throw Object.assign(new Error('Operator session unavailable'),{status:401,authCode:'NO_SESSION'});
  const {data,error}=await client.auth.getSession();
  if(error||!data.session?.access_token||data.session.expires_at&&data.session.expires_at*1000<=Date.now())throw Object.assign(new Error('Operator authentication required'),{status:401,authCode:error||data.session?.access_token?'INVALID_SESSION':'NO_SESSION'});
  const headers=new Headers(init.headers);
  headers.set('Authorization','Bearer '+data.session.access_token);
  return request<T>(path,{...init,headers:Object.fromEntries(headers.entries())});
 };
}

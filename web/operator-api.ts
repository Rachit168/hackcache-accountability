import type {SupabaseClient} from '@supabase/supabase-js';
type Api=<T=unknown>(path:string,init?:RequestInit)=>Promise<T>;

// Fail closed. Neither a missing nor expired operator identity may fall through to a citizen token.
// Header construction is canonical: caller-supplied Authorization cannot override staff identity.
export function operatorApiFor(client:Pick<SupabaseClient,'auth'>|undefined,request:Api):Api{
 return async <T=unknown>(path:string,init:RequestInit={})=>{
  if(!client)throw new Error('Operator session unavailable');
  const {data,error}=await client.auth.getSession();
  if(error||!data.session?.access_token)throw new Error('Operator authentication required');
  const headers=new Headers(init.headers);
  headers.set('Authorization','Bearer '+data.session.access_token);
  return request<T>(path,{...init,headers:Object.fromEntries(headers.entries())});
 };
}

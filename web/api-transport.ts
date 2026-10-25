export async function authenticatedFetch(path:string,init:RequestInit,getCitizenToken:()=>Promise<string|undefined>,send:typeof fetch=fetch):Promise<Response>{
 const headers=new Headers(init.headers);
 if(!headers.has('Content-Type'))headers.set('Content-Type','application/json');
 // An explicit staff identity must never be merged with, or refresh, citizen credentials.
 if(!headers.has('Authorization')){const token=await getCitizenToken();if(token)headers.set('Authorization','Bearer '+token);}
 return send('/api'+path,{...init,headers});
}

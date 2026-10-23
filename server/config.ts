import 'dotenv/config';
export function configuration(env:NodeJS.ProcessEnv=process.env) {
  const url=env.SUPABASE_URL?.trim(), key=env.SUPABASE_PUBLISHABLE_KEY?.trim(), db=env.DATABASE_URL?.trim(), ref=env.SUPABASE_PROJECT_REF?.trim();
  let valid=false;
  try { const auth=new URL(url ?? ''); const database=new URL(db ?? ''); const user=decodeURIComponent(database.username);
    let publicKey=!!key?.startsWith('sb_publishable_');
    if(key?.startsWith('eyJ')) publicKey=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role==='anon';
    const sameProject=(database.hostname===`db.${ref}.supabase.co`&&user==='hc_runtime')||(database.hostname.endsWith('.pooler.supabase.com')&&user===`hc_runtime.${ref}`);
    valid=!!ref && auth.protocol==='https:' && auth.hostname===`${ref}.supabase.co` && publicKey && ['postgres:','postgresql:'].includes(database.protocol) && sameProject && env.DEDICATED_PROJECT_CONFIRM===ref;
  } catch { /* Absent or invalid configuration stays unavailable. */ }
  return {ready:valid,url:valid?url!:undefined,key:valid?key!:undefined,databaseUrl:valid?db!:undefined};
}

import pg from 'pg';
import type { ComplaintInput, Receipt, CaseRecord } from '../domain/complaint.js';
export async function transaction<T>(pool:pg.Pool,actor:string,work:(client:pg.PoolClient,workspace:string)=>Promise<T>):Promise<T> {
  const client=await pool.connect(); let broken=false;
  try {
    await client.query('BEGIN');
    const role=await client.query<{safe:boolean}>("SELECT session_user='hc_runtime' AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreatedb AND NOT rolcreaterole AND NOT pg_has_role(current_user,'hc_owner','MEMBER') AND NOT pg_has_role(current_user,'hc_writer','MEMBER') AS safe FROM pg_roles WHERE rolname=current_user");
    if(!role.rows[0]?.safe) throw new Error('Unsafe database runtime role.');
    await client.query("SELECT set_config('app.actor_id',$1,true)",[actor]);
    const bootstrap=await client.query<{workspace:string}>('SELECT hc_private.bootstrap() AS workspace');
    const workspace=bootstrap.rows[0].workspace;
    await client.query("SELECT set_config('app.workspace_id',$1,true)",[workspace]);
    const value=await work(client,workspace);
    await client.query('COMMIT'); return value;
  } catch(error) { try { await client.query('ROLLBACK'); } catch { broken=true; } throw error;
  } finally { client.release(broken); }
}
export function caseStore(pool:pg.Pool) {
  return {
    submit:(actor:string,key:string,payload:ComplaintInput)=>transaction(pool,actor,async client=>{
      const result=await client.query<{receipt:Receipt}>('SELECT hc_private.submit_complaint($1::uuid,$2::jsonb) AS receipt',[key,JSON.stringify(payload)]);
      return result.rows[0].receipt;
    }),
    read:(actor:string,id:string)=>transaction(pool,actor,async client=>{
      const result=await client.query<{record:CaseRecord|null}>('SELECT hc_private.read_complaint($1::uuid) AS record',[id]); return result.rows[0].record;
    })
  };
}

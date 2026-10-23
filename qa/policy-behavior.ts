import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import type { ComplaintInput } from '../domain/complaint.js';

// Opened with migration credentials, but all data probes run as hc_writer:
// non-owner, non-superuser, non-BYPASSRLS, row_security on. No grants change.
export async function checkPolicyBehavior(audit: pg.Pool, actorA: string, actorB: string, payload: ComplaintInput) {
  const client=await audit.connect();
  let failure: unknown; let failed=false; let rollbackFailed=false;
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout='5s'");
    await client.query('SET LOCAL ROLE hc_writer');
    await client.query('SET LOCAL row_security=on');
    const context=await client.query(`SELECT current_user AS role,current_setting('row_security') AS row_security,rolsuper,rolbypassrls,
      EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='hc_private' AND c.relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)) AS owns_table
      FROM pg_roles WHERE rolname=current_user`);
    assert.equal(context.rows[0].role,'hc_writer');
    assert.equal(context.rows[0].row_security,'on');
    for(const field of ['rolsuper','rolbypassrls','owns_table']) assert.equal(context.rows[0][field],false);
    async function identity(actor:string,workspace:string) {
      await client.query("SELECT set_config('app.actor_id',$1,true),set_config('app.workspace_id',$2,true)",[actor,workspace]);
    }
    async function seed(actor:string) {
      await identity(actor,'');
      const workspace=(await client.query('SELECT hc_private.bootstrap() AS id')).rows[0].id as string;
      await identity(actor,workspace);
      const receipt=(await client.query('SELECT hc_private.submit_complaint($1,$2::jsonb) AS receipt',[randomUUID(),JSON.stringify(payload)])).rows[0].receipt;
      const original=(await client.query('SELECT id FROM hc_private.originals WHERE case_id=$1',[receipt.id])).rows[0].id as string;
      return {workspace,id:receipt.id as string,original};
    }
    const a=await seed(actorA),b=await seed(actorB);
    for(const [actor,workspace,visibleA,visibleB] of [
      [actorA,a.workspace,true,false],[actorB,b.workspace,false,true],
      [actorA,b.workspace,false,false],[actorB,a.workspace,false,false],
      ['',a.workspace,false,false],[actorA,'',false,false],
    ] as const) {
      await identity(actor,workspace);
      for(const table of ['cases','originals','concerns','events']) {
        const column=table==='cases'?'id':'case_id';
        const rows=await client.query(`SELECT ${column} AS case_id FROM hc_private.${table} WHERE ${column}=ANY($1::uuid[])`,[[a.id,b.id]]);
        const ids=new Set(rows.rows.map(row=>row.case_id));
        assert.equal(ids.has(a.id),visibleA,`${table} actor/workspace A visibility`);
        assert.equal(ids.has(b.id),visibleB,`${table} actor/workspace B visibility`);
      }
      // Bootstrap-table policies are actor-only by design.
      const workspaces=await client.query('SELECT id FROM hc_private.workspaces WHERE id=ANY($1::uuid[])',[[a.workspace,b.workspace]]);
      assert.deepEqual(workspaces.rows.map(row=>row.id),actor===actorA?[a.workspace]:actor===actorB?[b.workspace]:[]);
      const memberships=await client.query('SELECT actor_id FROM hc_private.memberships WHERE actor_id=ANY($1::uuid[])',[[actorA,actorB]]);
      assert.deepEqual(memberships.rows.map(row=>row.actor_id),actor?[actor]:[]);
    }
    await identity(actorA,a.workspace);
    const blockedWrites: [string,unknown[]][]=[
      ['INSERT INTO hc_private.workspaces(owner_id) VALUES($1)',[randomUUID()]],
      ["INSERT INTO hc_private.memberships(actor_id,workspace_id,role) VALUES($1,$2,'citizen')",[randomUUID(),b.workspace]],
      ["INSERT INTO hc_private.cases(workspace_id,actor_id,idempotency_key,payload,status) VALUES($1,$2,$3,$4::jsonb,'submitted')",[b.workspace,actorA,randomUUID(),JSON.stringify(payload)]],
      ['INSERT INTO hc_private.originals(case_id,workspace_id,narrative) VALUES($1,$2,$3)',[b.id,b.workspace,'Fictional forbidden row']],
      ["INSERT INTO hc_private.concerns(case_id,workspace_id,original_id,ordinal,type,wording) VALUES($1,$2,$3,999,'service','Fictional forbidden concern')",[b.id,b.workspace,b.original]],
      ["INSERT INTO hc_private.events(case_id,workspace_id,actor_id,sequence,action,original_id) VALUES($1,$2,$3,1,'submitted',$4)",[b.id,b.workspace,actorB,b.original]],
    ];
    for(const [sql,values] of blockedWrites) {
      await client.query('SAVEPOINT policy_write');
      try {await assert.rejects(client.query(sql,values),(error:unknown)=>(error as {code:string}).code==='42501');}
      finally {await client.query('ROLLBACK TO SAVEPOINT policy_write');}
    }
  } catch(error) {failed=true;failure=error;}
  try {await client.query('ROLLBACK');}
  catch(error) {rollbackFailed=true;failure=failed?new AggregateError([failure,error],'Policy checks and rollback failed'):error;failed=true;}
  finally {client.release(rollbackFailed);}
  if(failed) throw failure;
  console.log('RLS_POLICY_BEHAVIOR_PASSED: direct SELECT and rejected INSERT under hc_writer across actor/workspace combinations; all harness writes rolled back. Separate from runtime command/API evidence.');
}

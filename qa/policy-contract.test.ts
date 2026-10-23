import { describe, expect, it } from 'vitest';
import { assertPolicyContract, policyTables, type PolicyDefinition } from './policy-contract.js';

function definitions(): PolicyDefinition[] {
  const actor="(NULLIF(current_setting('app.actor_id'::text, true), ''::text))::uuid";
  const workspace="(NULLIF(current_setting('app.workspace_id'::text, true), ''::text))::uuid";
  return policyTables.map(table => {
    const expression=table==='workspaces'?`(owner_id = ${actor})`:table==='memberships'?`(actor_id = ${actor})`:
      `((workspace_id = ${workspace}) AND (EXISTS ( SELECT 1 FROM hc_private.memberships m WHERE ((m.workspace_id = ${table}.workspace_id) AND (m.actor_id = ${actor})))))`;
    return {tablename:table,policyname:table==='workspaces'?'workspace_actor':table==='memberships'?'membership_actor':'workspace_member',roles:['hc_writer'],cmd:'ALL',permissive:'PERMISSIVE',qual:expression,with_check:expression};
  });
}

describe('local policy-definition checker, not hosted RLS evidence', () => {
  it('accepts intended expressions despite incidental formatting and literal casts',()=>expect(()=>assertPolicyContract(definitions())).not.toThrow());
  it('rejects permissive true for either USING or WITH CHECK',()=>{
    for(const table of policyTables) for(const field of ['qual','with_check'] as const){
      const policies=definitions();policies.find(policy=>policy.tablename===table)![field]='true';
      expect(()=>assertPolicyContract(policies)).toThrow();
    }
  });
  it('rejects OR true and actor/workspace substitutions',()=>{
    for(const replacement of ['true OR ', '']){
      const policies=definitions();const policy=policies.find(p=>p.tablename==='cases')!;
      policy.qual=replacement?replacement+policy.qual:policy.qual!.replaceAll('app.actor_id','app.workspace_id');
      expect(()=>assertPolicyContract(policies)).toThrow();
    }
  });
  it('rejects wrong table/policy/role/command and extra permissive policies',()=>{
    for(const change of [
      (p:PolicyDefinition[])=>{p[0].tablename='other';},
      (p:PolicyDefinition[])=>{p[0].policyname='other';},
      (p:PolicyDefinition[])=>{p[0].roles=['public'];},
      (p:PolicyDefinition[])=>{p[0].cmd='SELECT';},
      (p:PolicyDefinition[])=>{p.push({...p[0],qual:'true',with_check:'true'});},
    ]){const policies=definitions();change(policies);expect(()=>assertPolicyContract(policies)).toThrow();}
  });
});

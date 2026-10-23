import assert from 'node:assert/strict';
import type pg from 'pg';
import { assertPolicyContract, expressionTokens, type PolicyDefinition } from './policy-contract.js';

const foundationTables = ['workspaces', 'memberships', 'cases', 'originals', 'concerns', 'events'];
const workflowTables = ['demo_principals','review_assignments','outgoing_versions','workflow_actions'];
const dataTables = [...foundationTables,...workflowTables];

export async function inspectPermissions(runtime: pg.Pool, audit: pg.Pool) {
  const roles = await audit.query(`SELECT rolname,rolcanlogin,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication
    FROM pg_roles WHERE rolname IN ('hc_runtime','hc_owner','hc_writer') ORDER BY rolname`);
  assert.equal(roles.rowCount, 3);
  for (const role of roles.rows) {
    for (const flag of ['rolsuper','rolbypassrls','rolcreatedb','rolcreaterole','rolreplication']) assert.equal(role[flag], false);
    assert.equal(role.rolcanlogin, role.rolname === 'hc_runtime');
  }
  const memberships = await audit.query(`SELECT parent.rolname AS inherited_role,child.rolname AS member
    FROM pg_auth_members m JOIN pg_roles parent ON parent.oid=m.roleid JOIN pg_roles child ON child.oid=m.member
    WHERE child.rolname IN ('hc_runtime','hc_writer','hc_owner')`);
  assert.equal(memberships.rowCount, 0, 'Application roles must not belong to other roles');
  const tables = await audit.query(`SELECT c.relname,r.rolname AS owner,c.relrowsecurity,c.relforcerowsecurity
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner
    WHERE n.nspname='hc_private' AND c.relname=ANY($1::text[])`, [dataTables]);
  assert.equal(tables.rowCount, dataTables.length);
  for (const table of tables.rows) {
    assert.equal(table.owner, 'hc_owner'); assert.equal(table.relrowsecurity, true); assert.equal(table.relforcerowsecurity, true);
  }
  const policies = await audit.query<PolicyDefinition>(`SELECT tablename,policyname,roles::text[] AS roles,cmd,permissive,qual,with_check FROM pg_policies
    WHERE schemaname='hc_private' AND tablename=ANY($1::text[]) ORDER BY tablename,policyname`, [dataTables]);
  assertPolicyContract(policies.rows.filter(row=>foundationTables.includes(row.tablename)&&row.policyname!=='assigned_reviewer'));
  const commandPolicies=policies.rows.filter(row=>workflowTables.includes(row.tablename));
  assert.equal(commandPolicies.length,4);
  for(const policy of commandPolicies){assert.equal(policy.policyname,'command_access');assert.deepEqual(policy.roles,['hc_writer']);assert.equal(policy.cmd,'ALL');assert.equal(policy.qual,'true');assert.equal(policy.with_check,'true');}
  const reviewerPolicies=policies.rows.filter(row=>row.policyname==='assigned_reviewer');
  assert.deepEqual(reviewerPolicies.map(row=>row.tablename).sort(),['cases','concerns','originals']);
  for(const policy of reviewerPolicies){
    assert.deepEqual(policy.roles,['hc_writer']);assert.equal(policy.cmd,'SELECT');assert.equal(policy.permissive,'PERMISSIVE');assert.equal(policy.with_check,null);
    const column=policy.tablename==='cases'?'id':'case_id';
    const expected="EXISTS (SELECT 1 FROM hc_private.review_assignments a JOIN hc_private.demo_principals p ON p.actor_id=a.reviewer_id WHERE a.case_id="+policy.tablename+"."+column+" AND a.reviewer_id=nullif(current_setting('app.actor_id',true),'')::uuid AND p.kind='reviewer')";
    assert.deepEqual(expressionTokens(policy.qual),expressionTokens(expected));
  }
  const functions = await audit.query(`SELECT p.proname,r.rolname AS owner,p.prosecdef,p.proconfig,
    has_function_privilege('hc_runtime',p.oid,'EXECUTE') AS runtime_execute,
    has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
    has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
    EXISTS(SELECT FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS public_execute
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner
    WHERE n.nspname='hc_private' ORDER BY p.proname`);
  assert.deepEqual(functions.rows.map(row => row.proname), ['bootstrap','read_complaint','submit_complaint','workflow_commit','workflow_read']);
  for (const fn of functions.rows) {
    assert.equal(fn.owner, 'hc_writer'); assert.equal(fn.prosecdef, true);
    assert.deepEqual(fn.proconfig, ['search_path=pg_catalog']); assert.equal(fn.runtime_execute, true);
    for (const flag of ['anon_execute','authenticated_execute','public_execute']) assert.equal(fn[flag], false);
  }
  const schema = await audit.query(`SELECT r.rolname AS owner,
    has_schema_privilege('hc_runtime',n.oid,'USAGE') AS runtime_usage,
    has_schema_privilege('hc_runtime',n.oid,'CREATE') AS runtime_create,
    has_schema_privilege('hc_writer',n.oid,'CREATE') AS writer_create,
    has_schema_privilege('anon',n.oid,'USAGE') AS anon_usage,
    has_schema_privilege('authenticated',n.oid,'USAGE') AS authenticated_usage,
    EXISTS(SELECT FROM aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE a.grantee=0) AS public_grant
    FROM pg_namespace n JOIN pg_roles r ON r.oid=n.nspowner WHERE n.nspname='hc_private'`);
  assert.equal(schema.rows[0].owner, 'hc_owner'); assert.equal(schema.rows[0].runtime_usage, true);
  for (const flag of ['runtime_create','writer_create','anon_usage','authenticated_usage','public_grant']) assert.equal(schema.rows[0][flag], false);
  for (const table of [...dataTables, 'migrations']) {
    for (const privilege of ['SELECT','INSERT','UPDATE','DELETE']) {
      const writer = await audit.query('SELECT has_table_privilege($1,$2,$3) AS allowed', ['hc_writer', `hc_private.${table}`, privilege]);
      const allowed=foundationTables.includes(table)?['SELECT','INSERT']:['outgoing_versions','workflow_actions'].includes(table)?['SELECT','INSERT']:workflowTables.includes(table)?['SELECT']:[];
      assert.equal(writer.rows[0].allowed, allowed.includes(privilege));
    }
    for (const role of ['hc_runtime','anon','authenticated']) for (const privilege of ['SELECT','INSERT','UPDATE','DELETE']) {
      const result = await audit.query('SELECT has_table_privilege($1,$2,$3) AS allowed', [role, `hc_private.${table}`, privilege]);
      assert.equal(result.rows[0].allowed, false, `${role} must lack ${privilege} on ${table}`);
    }
    for (const role of ['hc_runtime','anon','authenticated']) for (const privilege of ['SELECT','INSERT','UPDATE']) {
      const column = await audit.query('SELECT has_any_column_privilege($1,$2,$3) AS allowed', [role, `hc_private.${table}`, privilege]);
      assert.equal(column.rows[0].allowed, false, `${role} must lack column ${privilege} on ${table}`);
    }
    const publicGrant = await audit.query(`SELECT EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace,
      LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
      WHERE n.nspname='hc_private' AND c.relname=$1 AND a.grantee=0) AS allowed`, [table]);
    assert.equal(publicGrant.rows[0].allowed, false);
    // Direct runtime probes cannot write even if an unexpected grant is found:
    // statements affect zero rows and always run inside a rolled-back transaction.
    const client = await runtime.connect();
    try {
      for (const sql of [
        `SELECT * FROM hc_private.${table} WHERE false`,
        `INSERT INTO hc_private.${table} (${table === 'memberships' ? 'actor_id' : table === 'migrations' ? 'version' : 'id'}) SELECT NULL::${table === 'migrations' ? 'integer' : 'uuid'} WHERE false`,
        `UPDATE hc_private.${table} SET ${table === 'migrations' ? 'version=version' : 'id=id'} WHERE false`,
        `DELETE FROM hc_private.${table} WHERE false`,
      ]) {
        // memberships has actor_id, not id.
        const safeSql = ['memberships','demo_principals'].includes(table) ? sql.replace('SET id=id', 'SET actor_id=actor_id').replace('(id)','(actor_id)') : sql;
        await client.query('BEGIN');
        try { await assert.rejects(client.query(safeSql), (error: unknown) => (error as {code: string}).code === '42501'); }
        finally { await client.query('ROLLBACK'); }
      }
    } finally { client.release(); }
  }
  console.log(JSON.stringify({ check: 'permission_catalog_and_safe_runtime_probes', roles: roles.rows, memberships: memberships.rows, tables: tables.rows, policies: policies.rows, functions: functions.rows, schema: schema.rows }));
}

export async function checkPrivateSchemaExposure(url: string, publishableKey: string) {
  // A schema-not-exposed response is distinct from permission denial in an exposed schema.
  const response = await fetch(`${url}/rest/v1/cases?select=id&limit=0`, {
    headers: { apikey: publishableKey, 'Accept-Profile': 'hc_private' }, signal: AbortSignal.timeout(8000),
  });
  const body = await response.json() as {code?: string};
  assert.equal(response.status, 406, 'Private schema must be excluded from PostgREST profiles');
  assert.equal(body.code, 'PGRST106', 'Permission denial alone does not prove schema exclusion');
  console.log('PRIVATE_SCHEMA_EXPOSURE_CHECK_PASSED: PostgREST rejects hc_private profile (PGRST106). Dashboard management settings were not inspected.');
}

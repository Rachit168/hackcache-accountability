import assert from 'node:assert/strict';

export const policyTables = ['workspaces','memberships','cases','originals','concerns','events'];
export interface PolicyDefinition {
  tablename: string; policyname: string; roles: string[]; cmd: string;
  permissive: string; qual: string | null; with_check: string | null;
}

// Deliberately small, fail-closed token comparison for this migration's six
// expressions. Ignore incidental whitespace/parentheses, text-literal casts,
// identifier quoting and built-in schema qualification. No operators (including
// OR/NOT), references or predicates are removed. This is not a general SQL parser.
export function expressionTokens(expression: string | null): string[] {
  assert.equal(typeof expression, 'string');
  const tokens: string[] = [];
  const lexer = /\s+|'(?:''|[^'])*'|"(?:""|[^"])*"|[a-zA-Z_][a-zA-Z_0-9]*|[0-9]+|::|[().,=]/y;
  let offset = 0;
  while (offset < expression!.length) {
    lexer.lastIndex = offset;
    const match = lexer.exec(expression!);
    assert.ok(match, 'Unrecognised policy expression token');
    offset = lexer.lastIndex;
    const token = match[0];
    if (!/^\s+$/.test(token)) tokens.push(token.startsWith("'") ? token : token.startsWith('"') ? token.slice(1,-1).replaceAll('""','"') : token.toLowerCase());
  }
  return tokens.filter((token, index) => {
    if (token === '(' || token === ')') return false;
    if (token === '::' && tokens[index+1] === 'text') return false;
    if (token === 'text' && tokens[index-1] === '::') return false;
    if (token === 'pg_catalog' && tokens[index+1] === '.' && ['current_setting','nullif'].includes(tokens[index+2])) return false;
    if (token === '.' && tokens[index-1] === 'pg_catalog' && ['current_setting','nullif'].includes(tokens[index+1])) return false;
    return true;
  });
}

export function assertPolicyContract(policies: PolicyDefinition[]) {
  assert.equal(policies.length, policyTables.length, 'Exactly the expected six policies required');
  for (const table of policyTables) {
    const entries = policies.filter(policy => policy.tablename === table);
    assert.equal(entries.length, 1, `Exactly one policy required on ${table}`);
    const policy = entries[0];
    assert.equal(policy.policyname, table === 'workspaces' ? 'workspace_actor' : table === 'memberships' ? 'membership_actor' : 'workspace_member');
    assert.deepEqual(policy.roles, ['hc_writer']);
    assert.equal(policy.cmd, 'ALL'); assert.equal(policy.permissive, 'PERMISSIVE');
    const actor = "nullif(current_setting('app.actor_id',true),'')::uuid";
    const workspace = "nullif(current_setting('app.workspace_id',true),'')::uuid";
    const expected = table === 'workspaces' ? `owner_id = ${actor}`
      : table === 'memberships' ? `actor_id = ${actor}`
      : `workspace_id = ${workspace} AND EXISTS (SELECT 1 FROM hc_private.memberships m WHERE m.workspace_id = ${table}.workspace_id AND m.actor_id = ${actor})`;
    for (const expression of [policy.qual, policy.with_check]) {
      assert.deepEqual(expressionTokens(expression), expressionTokens(expected), `${table} must enforce the expected actor/workspace restriction`);
    }
  }
}

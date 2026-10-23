import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { withRaceClients } from './race-cleanup.js';

export async function workflowCommandRace(runtime: pg.Pool, audit: pg.Pool, actor: string, caseId: string, content: object) {
  const key = randomUUID();
  const unused = await audit.query('SELECT count(*)::int AS count FROM hc_private.outgoing_versions WHERE actor_id=$1 AND command_key=$2', [actor, key]);
  assert.equal(unused.rows[0].count, 0, 'Race must use an unused workflow command key');
  const evidence = await withRaceClients(() => runtime.connect(), async (first, second, observe) => {
    const ids = await Promise.all([first.query('SELECT pg_backend_pid() AS pid'), second.query('SELECT pg_backend_pid() AS pid')]);
    const [pid1, pid2] = ids.map(result => result.rows[0].pid as number);
    assert.notEqual(pid1, pid2, 'Distinct PostgreSQL backends required');
    for (const client of [first, second]) {
      await client.query('BEGIN');
      await client.query("SET LOCAL statement_timeout='8s'");
      await client.query("SELECT set_config('app.actor_id',$1,true)", [actor]);
    }
    const sql = 'SELECT hc_private.workflow_commit($1::uuid,$2::uuid,$3::text,$4::jsonb) AS value';
    const values = [caseId, key, 'release', JSON.stringify(content)];
    const a = await first.query<{ value: { id: string } }>(sql, values);
    const pending = second.query<{ value: { id: string } }>(sql, values);
    observe(second, pending);
    let blocked = false;
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      const wait = await audit.query('SELECT $2::int = ANY(pg_blocking_pids($1::int)) AS blocked', [pid2, pid1]);
      if (wait.rows[0].blocked) { blocked = true; break; }
      await new Promise(resolve => setTimeout(resolve, 40));
    }
    assert.ok(blocked, 'Must observe second workflow command blocked by first backend');
    await first.query('COMMIT');
    const b = await pending;
    await second.query('COMMIT');
    assert.deepEqual(a.rows[0].value, b.rows[0].value, 'Identical command retries must return the same result');
    const id = a.rows[0].value.id;
    const counts = await audit.query('SELECT count(*)::int AS count FROM hc_private.outgoing_versions WHERE actor_id=$1 AND command_key=$2 AND case_id=$3', [actor, key, caseId]);
    assert.equal(counts.rows[0].count, 1, 'Exactly one release must be retained');
    return { key, versionId: id, backendPids: [pid1, pid2], observedBlocking: blocked, retainedReleases: counts.rows[0].count };
  });

  await withRaceClients(() => runtime.connect(), async conflict => {
    await conflict.query('BEGIN');
    await conflict.query("SELECT set_config('app.actor_id',$1,true)", [actor]);
    const changed = { ...content, narrative: (content as { narrative: string }).narrative + ' changed' };
    await assert.rejects(conflict.query('SELECT hc_private.workflow_commit($1::uuid,$2::uuid,$3::text,$4::jsonb)', [caseId, key, 'release', JSON.stringify(changed)]), (error: unknown) => (error as { code?: string }).code === 'HC409');
  });

  const rollbackKey = randomUUID();
  await withRaceClients(() => runtime.connect(), async rollback => {
    await rollback.query('BEGIN');
    await rollback.query("SELECT set_config('app.actor_id',$1,true)", [actor]);
    await rollback.query('SELECT hc_private.workflow_commit($1::uuid,$2::uuid,$3::text,$4::jsonb)', [caseId, rollbackKey, 'release', JSON.stringify({ ...content, narrative: (content as { narrative: string }).narrative + ' rollback fixture' })]);
  });
  const rolledBack = await audit.query('SELECT count(*)::int AS count FROM hc_private.outgoing_versions WHERE actor_id=$1 AND command_key=$2', [actor, rollbackKey]);
  assert.equal(rolledBack.rows[0].count, 0, 'Explicit rollback must leave no workflow version');
  const result = { ...evidence, changedContentConflict: true, rolledBackReleaseCount: rolledBack.rows[0].count };
  console.log('WORKFLOW_COMMAND_RACE_PASSED ' + JSON.stringify(result));
  return result;
}

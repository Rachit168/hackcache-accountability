import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import type { ComplaintInput, Receipt } from '../domain/complaint.js';
import { transaction } from '../server/database.js';

export async function firstSubmissionRace(runtime: pg.Pool, audit: pg.Pool, actor: string, payload: ComplaintInput) {
  const key = randomUUID();
  const workspace = await transaction(runtime, actor, async (_client, id) => id);
  const unused = await audit.query('SELECT count(*)::int AS count FROM hc_private.cases WHERE actor_id=$1 AND idempotency_key=$2', [actor, key]);
  assert.equal(unused.rows[0].count, 0, 'Race must use an unsubmitted actor/key pair');

  // Pin both connections before BEGIN. A max:1 pool cannot satisfy this check.
  const first = await runtime.connect();
  let second: pg.PoolClient | undefined;
  let pending: Promise<pg.QueryResult<{ receipt: Receipt }>> | undefined;
  try {
    second = await runtime.connect();
    const pids = await Promise.all([first.query('SELECT pg_backend_pid() AS pid'), second.query('SELECT pg_backend_pid() AS pid')]);
    const [pid1, pid2] = pids.map(result => result.rows[0].pid as number);
    assert.notEqual(pid1, pid2, 'Independent PostgreSQL backends required');
    for (const client of [first, second]) {
      await client.query('BEGIN');
      await client.query("SET LOCAL statement_timeout='8s'");
      await client.query("SELECT set_config('app.actor_id',$1,true),set_config('app.workspace_id',$2,true)", [actor, workspace]);
    }
    const sql = 'SELECT hc_private.submit_complaint($1::uuid,$2::jsonb) AS receipt';
    const values = [key, JSON.stringify(payload)];
    const a = await first.query<{ receipt: Receipt }>(sql, values);
    // A's first submission is uncommitted; B must encounter the same first-write lock.
    pending = second.query<{ receipt: Receipt }>(sql, values);
    void pending.catch(() => undefined); // Observe immediately, including on assertion failure.
    let blocked = false;
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      const wait = await audit.query('SELECT $2::int = ANY(pg_blocking_pids($1::int)) AS blocked', [pid2, pid1]);
      if (wait.rows[0].blocked) { blocked = true; break; }
      await new Promise(resolve => setTimeout(resolve, 40));
    }
    assert.ok(blocked, 'Must observe B blocked by the distinct uncommitted A backend');
    await first.query('COMMIT');
    const b = await pending;
    await second.query('COMMIT');
    assert.deepEqual(a.rows[0].receipt, b.rows[0].receipt);
    const id = a.rows[0].receipt.id;
    const counts = await audit.query(`SELECT
      (SELECT count(*)::int FROM hc_private.cases WHERE actor_id=$1 AND idempotency_key=$2) AS cases,
      (SELECT count(*)::int FROM hc_private.originals WHERE case_id=$3) AS originals,
      (SELECT count(*)::int FROM hc_private.concerns WHERE case_id=$3) AS concerns,
      (SELECT count(*)::int FROM hc_private.events WHERE case_id=$3) AS events`, [actor, key, id]);
    assert.deepEqual(counts.rows[0], { cases: 1, originals: 1, concerns: payload.concerns.length, events: 1 });
    // These IDs are backend process IDs and fictional case IDs, never credentials.
    console.log(JSON.stringify({ check: 'competing_first_submissions', backendPids: [pid1, pid2], observedBlocking: blocked, counts: counts.rows[0] }));
    return { key, receipt: a.rows[0].receipt };
  } finally {
    // Roll back A first so any B wait is released on an assertion failure.
    try { await first.query('ROLLBACK'); } finally { first.release(); }
    if (second) {
      try { if (pending) await pending.catch(() => undefined); await second.query('ROLLBACK'); }
      finally { second.release(); }
    }
  }
}

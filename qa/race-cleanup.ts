interface CleanupClient {
  query(sql: string): Promise<unknown>;
  release(discard?: boolean): void;
}

async function bounded<T>(work: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Race cleanup deadline exceeded; connection discarded')), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

// Controlled dependency seam for checker tests. Not a PostgreSQL substitute.
export async function withRaceClients<C extends CleanupClient, T>(
  connect: () => Promise<C>,
  check: (first: C, second: C, observe: (client: C, pending: Promise<unknown>) => void) => Promise<T>,
  cleanupTimeoutMs = 10000,
): Promise<T> {
  const acquired: C[] = [];
  const pending = new Map<C, Promise<PromiseSettledResult<unknown>>[]>();
  const errors: unknown[] = [];
  let result: T | undefined;
  let failed = false;
  let original: unknown;
  try {
    acquired.push(await connect());
    acquired.push(await connect());
    result = await check(acquired[0], acquired[1], (client, query) => {
      // Install both outcomes immediately, so late rejection is always observed.
      const outcome = query.then(
        value => ({ status: 'fulfilled' as const, value }),
        reason => ({ status: 'rejected' as const, reason }),
      );
      pending.set(client, [...(pending.get(client) ?? []), outcome]);
    });
  } catch (error) { failed = true; original = error; }

  // A is attempted first to release B's lock wait. Failure cannot skip B.
  for (const client of acquired) {
    let discard = false;
    try {
      await bounded((async () => {
        await client.query('ROLLBACK');
        const outcomes = await Promise.all(pending.get(client) ?? []);
        const rejected = outcomes.filter(item => item.status === 'rejected');
        if (rejected.length) throw new AggregateError(rejected.map(item => item.reason), 'Pending race query failed');
      })(), cleanupTimeoutMs);
    } catch (error) { discard = true; errors.push(error); }
    try { client.release(discard); } catch (error) { errors.push(error); }
  }
  if (failed && errors.length) throw new AggregateError([original, ...errors], 'Race check and cleanup failed');
  if (failed) throw original;
  if (errors.length) throw new AggregateError(errors, 'Race cleanup failed; result is not accepted');
  return result as T;
}

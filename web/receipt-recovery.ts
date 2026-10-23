export type RecoveryResult<T> =
  | { kind: 'recovered'; value: T }
  | { kind: 'identity-unavailable' | 'identity-changed' | 'refresh-failed' | 'timed-out' }
  | { kind: 'receipt-failed'; status: number };

type RecoveryDependencies<T> = {
  getIdentity: () => Promise<string | undefined>;
  refreshIdentity: () => Promise<string | undefined>;
  retryReceipt: () => Promise<T>;
};

/** Shares one in-flight refresh and retries the receipt only for the same identity. */
export function createReceiptRecovery<T>(dependencies: RecoveryDependencies<T>, timeoutMs = 15_000) {
  let inFlight: Promise<RecoveryResult<T>> | undefined;
  let refreshPending = false;
  let receiptPending = false;
  const timedOut = Symbol('timed-out');
  const bounded = async <V>(operation: Promise<V>): Promise<V | typeof timedOut> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([operation, new Promise<typeof timedOut>((resolve) => { timer = setTimeout(() => resolve(timedOut), timeoutMs); })]);
    } finally { if (timer) clearTimeout(timer); }
  };

  return function recover(): Promise<RecoveryResult<T>> {
    if (!inFlight) {
      if (refreshPending || receiptPending) return Promise.resolve({ kind: 'timed-out' });
      const task = (async (): Promise<RecoveryResult<T>> => {
        let identityResult: string | undefined | typeof timedOut;
        try { identityResult = await bounded(dependencies.getIdentity()); } catch { return { kind: 'refresh-failed' }; }
        if (identityResult === timedOut) return { kind: 'timed-out' };
        const identity = identityResult;
        if (!identity) return { kind: 'identity-unavailable' };
        let refreshedResult: string | undefined | typeof timedOut;
        try {
          const refreshOperation = dependencies.refreshIdentity();
          refreshPending = true;
          void refreshOperation.finally(() => { refreshPending = false; }).catch(() => undefined);
          refreshedResult = await bounded(refreshOperation);
        } catch { refreshPending = false; return { kind: 'refresh-failed' }; }
        if (refreshedResult === timedOut) return { kind: 'timed-out' };
        const refreshedIdentity = refreshedResult;
        if (!refreshedIdentity) return { kind: 'refresh-failed' };
        if (refreshedIdentity !== identity) return { kind: 'identity-changed' };
        try {
          const receiptOperation = dependencies.retryReceipt();
          receiptPending = true;
          void receiptOperation.finally(() => { receiptPending = false; }).catch(() => undefined);
          const value = await bounded(receiptOperation);
          return value === timedOut ? { kind: 'timed-out' } : { kind: 'recovered', value };
        }
        catch (error) {
          const status = typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number' ? error.status : 0;
          return { kind: 'receipt-failed', status };
        }
      })();
      inFlight = task.finally(() => { inFlight = undefined; });
    }
    return inFlight;
  };
}

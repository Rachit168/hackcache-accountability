import { describe, expect, it, vi } from 'vitest';
import { createReceiptRecovery } from '../web/receipt-recovery';
import { attachLeaveWarning, copyExactReference, fieldErrorSummary, shouldWarnOnLeave } from '../web/form-usability';
import { translate } from '../web/i18n';

describe('same-identity receipt recovery', () => {
  it('refreshes the retained identity before retrying the original receipt', async () => {
    const retryReceipt = vi.fn().mockResolvedValue({ id: 'original-id' });
    const recover = createReceiptRecovery({ getIdentity: async () => 'identity-a', refreshIdentity: async () => 'identity-a', retryReceipt });
    await expect(recover()).resolves.toEqual({ kind: 'recovered', value: { id: 'original-id' } });
    expect(retryReceipt).toHaveBeenCalledOnce();
  });

  it('keeps the saved identity untouched when refresh fails and never retries under a new one', async () => {
    const retryReceipt = vi.fn();
    const recover = createReceiptRecovery({ getIdentity: async () => 'identity-a', refreshIdentity: async () => { throw new Error('offline'); }, retryReceipt });
    await expect(recover()).resolves.toEqual({ kind: 'refresh-failed' });
    expect(retryReceipt).not.toHaveBeenCalled();
  });

  it('does not retry if the refreshed identity is missing or changed', async () => {
    const retryReceipt = vi.fn();
    const noIdentity = createReceiptRecovery({ getIdentity: async () => undefined, refreshIdentity: async () => 'identity-b', retryReceipt });
    const changedIdentity = createReceiptRecovery({ getIdentity: async () => 'identity-a', refreshIdentity: async () => 'identity-b', retryReceipt });
    await expect(noIdentity()).resolves.toEqual({ kind: 'identity-unavailable' });
    await expect(changedIdentity()).resolves.toEqual({ kind: 'identity-changed' });
    expect(retryReceipt).not.toHaveBeenCalled();
  });

  it('shares repeated clicks and bounds a refresh that never settles', async () => {
    let finishRefresh!: (identity: string) => void;
    const refreshIdentity = vi.fn()
      .mockImplementationOnce(() => new Promise<string>((resolve) => { finishRefresh = resolve; }))
      .mockResolvedValue('identity-a');
    const retryReceipt = vi.fn().mockResolvedValue(undefined);
    const recover = createReceiptRecovery({ getIdentity: async () => 'identity-a', refreshIdentity, retryReceipt }, 5);
    const first = recover();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const second = recover();
    expect(refreshIdentity).toHaveBeenCalledOnce();
    await expect(first).resolves.toEqual({ kind: 'timed-out' });
    await expect(second).resolves.toEqual({ kind: 'timed-out' });
    await expect(recover()).resolves.toEqual({ kind: 'timed-out' });
    expect(refreshIdentity).toHaveBeenCalledOnce();
    finishRefresh('identity-a');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await Promise.resolve();
    await Promise.resolve();
    expect(retryReceipt).not.toHaveBeenCalled();
    await expect(recover()).resolves.toEqual({ kind: 'recovered', value: undefined });
    expect(refreshIdentity).toHaveBeenCalledTimes(2);
  });
});

describe('form recovery controls', () => {
  it('keeps summary links mapped to the remaining concern after removal and localizes the label', () => {
    const beforeRemoval = fieldErrorSummary({ 'concern-a': 'concernError', 'concern-b': 'concernError', declaration: 'declarationError' }, [{ uiId: 'concern-a' }, { uiId: 'concern-b' }]);
    const afterRemoval = fieldErrorSummary({ 'concern-b': 'concernError', declaration: 'declarationError' }, [{ uiId: 'concern-b' }]);
    expect(beforeRemoval.map(({ targetId }) => targetId)).toEqual(['concern-a-wording', 'concern-b-wording', 'declaration']);
    expect(afterRemoval.map(({ targetId }) => targetId)).toEqual(['concern-b-wording', 'declaration']);
    expect(translate('hi', 'concern') + ' ' + afterRemoval[0].concernNumber).toBe('मुद्दा 1');
  });

  it('warns only for meaningful unsent work and clears the warning after successful submission', () => {
    const initialConcerns = [{ wording: '' }, { wording: '' }];
    expect(shouldWarnOnLeave('', initialConcerns, false, false)).toBe(false);
    expect(shouldWarnOnLeave('  ', initialConcerns, false, false)).toBe(false);
    expect(shouldWarnOnLeave('A fictional account', initialConcerns, false, false)).toBe(true);
    expect(shouldWarnOnLeave('', [{ wording: 'An issue' }], false, false)).toBe(true);
    expect(shouldWarnOnLeave('A fictional account', initialConcerns, false, true)).toBe(false);
  });

  it('attaches and removes the beforeunload listener and requests the browser-owned generic prompt', () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const cleanup = attachLeaveWarning({ addEventListener, removeEventListener } as unknown as Window);
    const listener = addEventListener.mock.calls[0][1] as (event: BeforeUnloadEvent) => void;
    const preventDefault = vi.fn();
    const event = { preventDefault, returnValue: '' } as unknown as BeforeUnloadEvent;
    listener(event);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(event.returnValue).toBe(' ');
    cleanup();
    expect(removeEventListener).toHaveBeenCalledOnce();
    expect(removeEventListener.mock.calls[0]).toEqual(addEventListener.mock.calls[0]);
  });

  it('copies only the exact UUID and reports clipboard failure without changing the reference', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(await copyExactReference('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', writeText)).toBe(true);
    expect(writeText).toHaveBeenCalledExactlyOnceWith('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
    expect(await copyExactReference('case-id', async () => { throw new Error('denied'); })).toBe(false);
  });
});

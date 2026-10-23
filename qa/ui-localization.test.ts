import { describe, expect, it } from 'vitest';
import { translate, type CopyKey } from '../web/i18n';
import { receiptFailureState } from '../web/receipt-state';

describe('citizen interface localization', () => {
  it('provides translated validation and receipt copy with concern numbering', () => {
    const keys: CopyKey[] = ['narrativeError', 'concernError', 'declarationError', 'receiptTitle', 'receiptStatusSubmitted'];
    for (const key of keys) {
      expect(translate('en', key)).not.toBe(translate('hi', key));
      expect(translate('en', key)).not.toContain('{n}');
      expect(translate('hi', key)).not.toContain('{n}');
    }
    expect(translate('en', 'concernType', { n: 4 })).toBe('Type for concern 4');
    expect(translate('hi', 'concernType', { n: 4 })).toBe('मुद्दा 4 का प्रकार');
  });
});

describe('receipt failure classification', () => {
  it('masks invalid, inaccessible and absent references as not found', () => {
    for (const status of [400, 403, 404]) expect(receiptFailureState(status)).toBe('not-found');
  });
  it('offers session recovery only for authentication failure', () => {
    expect(receiptFailureState(401)).toBe('auth-error');
  });
  it('keeps network and server errors retryable', () => {
    for (const status of [0, 408, 429, 500, 503]) expect(receiptFailureState(status)).toBe('unavailable');
  });
});

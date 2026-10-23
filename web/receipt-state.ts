export type ReceiptFailureState = 'not-found' | 'auth-error' | 'unavailable';

export function receiptFailureState(status: number): ReceiptFailureState {
  if (status === 400 || status === 403 || status === 404) return 'not-found';
  if (status === 401) return 'auth-error';
  return 'unavailable';
}

import type { FormError } from './form-types';

export type SummaryConcern = { uiId: string };
export type SummaryItem = { field: string; targetId: string; error: FormError; labelKey: 'account' | 'concern' | 'declaration'; concernNumber?: number };

export function fieldErrorSummary(errors: Record<string, FormError>, concerns: SummaryConcern[]): SummaryItem[] {
  const items: SummaryItem[] = [];
  if (errors.narrative) items.push({ field: 'narrative', targetId: 'narrative', error: errors.narrative, labelKey: 'account' });
  concerns.forEach((concern, index) => {
    if (errors[concern.uiId]) items.push({ field: concern.uiId, targetId: `${concern.uiId}-wording`, error: errors[concern.uiId], labelKey: 'concern', concernNumber: index + 1 });
  });
  if (errors.declaration) items.push({ field: 'declaration', targetId: 'declaration', error: errors.declaration, labelKey: 'declaration' });
  return items;
}

export function hasMeaningfulUnsentContent(narrative: string, concerns: Array<{ wording: string }>, declaration: boolean): boolean {
  return narrative.trim().length > 0 || concerns.some(({ wording }) => wording.trim().length > 0) || declaration;
}

export function shouldWarnOnLeave(narrative: string, concerns: Array<{ wording: string }>, declaration: boolean, submitted: boolean): boolean {
  return !submitted && hasMeaningfulUnsentContent(narrative, concerns, declaration);
}

export function attachLeaveWarning(target: Pick<Window, 'addEventListener' | 'removeEventListener'>): () => void {
  const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ' '; };
  target.addEventListener('beforeunload', warn);
  return () => target.removeEventListener('beforeunload', warn);
}

export async function copyExactReference(reference: string, writeText: (value: string) => Promise<void>): Promise<boolean> {
  try { await writeText(reference); return true; } catch { return false; }
}

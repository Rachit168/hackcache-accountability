export type WorkflowAction = 'release' | 'acknowledge' | 'response';
export type PendingPhase = 'sending' | 'uncertain' | 'confirmed';
export type PendingWorkflowCommand = { key: string; action: WorkflowAction; snapshot: string; phase: PendingPhase };

export function workflowScope(caseId: string, action: WorkflowAction, versionId?: string): string {
  return [caseId, versionId ?? 'case', action].join(':');
}

export function newCommandKey(previous: string | undefined, generate: () => string): string {
  const next = generate();
  if (next === previous) throw new Error('A changed command needs a fresh key');
  return next;
}

export function workflowSnapshot(body: unknown): string {
  return JSON.stringify(body);
}

export function isCompletedCommand(completed: Record<string, string>, scope: string, body: unknown): boolean {
  return completed[scope] === workflowSnapshot(body);
}

export function commandFailure(status: number | undefined): 'validation' | 'denied' | 'conflict' | 'uncertain' {
  if (status === 400 || status === 413) return 'validation';
  if (status === 401 || status === 403 || status === 404) return 'denied';
  if (status === 409) return 'conflict';
  return 'uncertain';
}

export function writeConfirmed(pending: PendingWorkflowCommand): PendingWorkflowCommand {
  return { ...pending, phase: 'confirmed' };
}

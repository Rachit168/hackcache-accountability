import { describe, expect, it } from 'vitest';
import { commandFailure, isCompletedCommand, newCommandKey, workflowScope, workflowSnapshot, writeConfirmed, type PendingWorkflowCommand } from '../web/workflow-state';

describe('Phase 2A staff draft and command identity', () => {
  it('scopes drafts and command keys by case, outgoing version and action', () => {
    const scopes = [
      workflowScope('case-a', 'acknowledge', 'version-1'),
      workflowScope('case-a', 'response', 'version-1'),
      workflowScope('case-a', 'acknowledge', 'version-2'),
      workflowScope('case-b', 'acknowledge', 'version-1'),
    ];
    expect(new Set(scopes).size).toBe(4);
  });

  it('keeps a pending immutable request identity through uncertain outcome and readback confirmation', () => {
    const pending: PendingWorkflowCommand = {
      key: 'command-original', action: 'response',
      snapshot: JSON.stringify({ versionId: 'version-2', text: 'Fictional response' }), phase: 'uncertain',
    };
    const confirmed = writeConfirmed(pending);
    expect(confirmed).toEqual({ ...pending, phase: 'confirmed' });
    expect(confirmed.key).toBe('command-original');
    expect(confirmed.snapshot).toBe(pending.snapshot);
    expect(JSON.parse(confirmed.snapshot)).toEqual({ versionId: 'version-2', text: 'Fictional response' });
  });

  it('uses a fresh key after an intentional edit and rejects accidental reuse', () => {
    expect(newCommandKey('command-a', () => 'command-b')).toBe('command-b');
    expect(() => newCommandKey('command-a', () => 'command-a')).toThrow('A changed command needs a fresh key');
  });

  it('prevents the same confirmed statement from being submitted twice but permits an edited one', () => {
    const scope = workflowScope('case-a', 'response', 'version-2');
    const completed = { [scope]: workflowSnapshot({ versionId: 'version-2', text: 'First response' }) };
    expect(isCompletedCommand(completed, scope, { versionId: 'version-2', text: 'First response' })).toBe(true);
    expect(isCompletedCommand(completed, scope, { versionId: 'version-2', text: 'Amended response' })).toBe(false);
    expect(isCompletedCommand(completed, workflowScope('case-a', 'acknowledge', 'version-2'), { versionId: 'version-2', text: 'First response' })).toBe(false);
  });

  it('maps structured HTTP outcomes to safe localized UI categories', () => {
    expect(commandFailure(400)).toBe('validation');
    expect(commandFailure(401)).toBe('denied');
    expect(commandFailure(403)).toBe('denied');
    expect(commandFailure(404)).toBe('denied');
    expect(commandFailure(409)).toBe('conflict');
    for (const status of [undefined, 0, 408, 429, 500, 503]) expect(commandFailure(status)).toBe('uncertain');
  });
});

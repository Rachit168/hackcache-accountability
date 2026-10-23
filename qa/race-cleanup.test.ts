import { describe, expect, it, vi } from 'vitest';
import { withRaceClients } from './race-cleanup.js';

function fixture(firstRollback?: Error, secondRollback?: Error) {
  const make = (failure?: Error) => ({
    query: vi.fn(async (_sql: string) => { if (failure) throw failure; return {}; }),
    release: vi.fn(),
  });
  const first = make(firstRollback), second = make(secondRollback);
  const connect = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
  return { first, second, connect };
}

describe('local race-checker cleanup dependencies; not PostgreSQL acceptance', () => {
  it('cleans and releases both clients on ordinary success', async () => {
    const f = fixture();
    expect(await withRaceClients(f.connect, async () => 'checked')).toBe('checked');
    for (const client of [f.first, f.second]) {
      expect(client.query).toHaveBeenCalledWith('ROLLBACK'); expect(client.release).toHaveBeenCalledWith(false);
    }
  });
  it('preserves original assertion/query failure after successful rollback', async () => {
    const f = fixture(), original = new Error('original query failure');
    await expect(withRaceClients(f.connect, async () => { throw original; })).rejects.toBe(original);
    for (const client of [f.first, f.second]) expect(client.release).toHaveBeenCalledWith(false);
  });
  it('discards A after rollback failure, still cleans B and combines original failure', async () => {
    const rollback = new Error('A rollback failure'), original = new Error('assertion failure');
    const f = fixture(rollback);
    const error = await withRaceClients(f.connect, async () => { throw original; }).catch(e => e);
    expect(error).toBeInstanceOf(AggregateError); expect(error.errors).toEqual([original, rollback]);
    expect(f.first.release).toHaveBeenCalledWith(true);
    expect(f.second.query).toHaveBeenCalledWith('ROLLBACK'); expect(f.second.release).toHaveBeenCalledWith(false);
  });
  it('discards B after rollback failure and refuses a successful result', async () => {
    const f = fixture(undefined, new Error('B rollback failure'));
    await expect(withRaceClients(f.connect, async () => 'otherwise successful')).rejects.toBeInstanceOf(AggregateError);
    expect(f.first.release).toHaveBeenCalledWith(false); expect(f.second.release).toHaveBeenCalledWith(true);
  });
  it('bounds an unresolved pending query and discards its connection', async () => {
    const f = fixture();
    await expect(withRaceClients(f.connect, async (_a, b, observe) => {
      observe(b, new Promise(() => undefined)); return 'not accepted';
    }, 15)).rejects.toBeInstanceOf(AggregateError);
    expect(f.first.release).toHaveBeenCalledWith(false); expect(f.second.release).toHaveBeenCalledWith(true);
  });
  it('observes a rejected pending query and refuses success', async () => {
    const f = fixture();
    await expect(withRaceClients(f.connect, async (_a, b, observe) => {
      observe(b, Promise.reject(new Error('pending failure'))); return 'not accepted';
    })).rejects.toBeInstanceOf(AggregateError);
    expect(f.second.release).toHaveBeenCalledWith(true);
  });
  it('attempts B cleanup when A rollback never settles', async () => {
    const f = fixture(); f.first.query.mockImplementation(() => new Promise(() => undefined));
    await expect(withRaceClients(f.connect, async () => true, 15)).rejects.toBeInstanceOf(AggregateError);
    expect(f.first.release).toHaveBeenCalledWith(true); expect(f.second.release).toHaveBeenCalledWith(false);
  });
});

import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { complaintSchema } from '../domain/complaint.js';
import { createApp } from '../server/app.js';
import { complaintRequestLimitBytes, maximumCompactComplaintBytes } from '../server/request-limits.js';

const actor = '10000000-0000-4000-8000-000000000001';
const key = '20000000-0000-4000-8000-000000000001';
const transportLimit = 512 * 1024;

function maximumPayload(character: string) {
  const text = (length: number) => character.repeat(length).slice(0, length);
  return {
    narrative: text(12000),
    office: 'SAMPLE_MUNICIPAL_DESK',
    category: 'SAMPLE_MUNICIPAL_SERVICE',
    concerns: Array.from({ length: 30 }, () => ({ type: 'service', wording: text(2000) })),
    declaration: true,
  };
}

// Escape every UTF-16 unit in every JSON string, including property names.
function fullyEscapedJson(value: unknown) {
  return JSON.stringify(value).replace(/"(?:\\.|[^"\\])*"/g, token => {
    const text: string = JSON.parse(token);
    return '"' + text.split('').map(unit => '\\u' + unit.charCodeAt(0).toString(16).padStart(4, '0')).join('') + '"';
  });
}

function fixture() {
  const submit = vi.fn().mockResolvedValue({ id: key, status: 'submitted', submittedAt: '2026-10-23T00:00:00Z' });
  const app = createApp({
    config: { ready: true, url: undefined, key: undefined, databaseUrl: undefined },
    verify: async () => actor,
    store: { submit, read: vi.fn() },
  });
  return {
    submit,
    send: (body: string | object) => request(app).post('/api/complaints').auth('local-test', { type: 'bearer' })
      .set('Idempotency-Key', key).set('Content-Type', 'application/json').send(body),
  };
}

describe('schema-sized request transport (local dependency tests only)', () => {
  it('submits maximum-length Hindi instead of rejecting its UTF-8 bytes', async () => {
    const payload = maximumPayload('क');
    expect(complaintSchema.safeParse(payload).success).toBe(true);
    expect(Buffer.byteLength(JSON.stringify(payload))).toBeGreaterThan(128 * 1024);
    const { submit, send } = fixture();
    expect((await send(payload)).status).toBe(201);
    expect(submit).toHaveBeenCalledWith(actor, key, payload);
  });

  it('submits maximum content containing quotes, backslashes and control escapes', async () => {
    const payload = maximumPayload('"\\\u0001');
    const raw = JSON.stringify(payload);
    expect(Buffer.byteLength(raw)).toBeGreaterThan(128 * 1024);
    const { submit, send } = fixture();
    expect((await send(raw)).status).toBe(201);
    expect(submit).toHaveBeenCalledWith(actor, key, payload);
  });

  it('fits even fully unicode-escaped values and keys within the bounded transport', async () => {
    const payload = maximumPayload('क');
    const raw = fullyEscapedJson(payload);
    expect(JSON.parse(raw)).toEqual(payload);
    expect(Buffer.byteLength(raw)).toBeLessThan(transportLimit);
    expect(Buffer.byteLength(raw)).toBeLessThanOrEqual(maximumCompactComplaintBytes);
    expect(complaintRequestLimitBytes).toBe(transportLimit);
    const { submit, send } = fixture();
    expect((await send(raw)).status).toBe(201);
    expect(submit).toHaveBeenCalledWith(actor, key, payload);
  });

  it('still rejects narrative, concern and concern-count field overflows', async () => {
    const base = maximumPayload('x');
    const { submit, send } = fixture();
    for (const payload of [
      { ...base, narrative: 'x'.repeat(12001) },
      { ...base, narrative: ' '.repeat(12000) + 'x' },
      { ...base, concerns: [{ type: 'service', wording: 'x'.repeat(2001) }] },
      { ...base, concerns: [{ type: 'service', wording: ' '.repeat(2000) + 'x' }] },
      { ...base, concerns: [...base.concerns, base.concerns[0]] },
    ]) expect((await send(payload)).status).toBe(400);
    expect(submit).not.toHaveBeenCalled();
  });

  it('rejects excessive transport bytes before reaching submission', async () => {
    const { submit, send } = fixture();
    expect((await send({ narrative: 'x'.repeat(transportLimit) })).status).toBe(413);
    expect(submit).not.toHaveBeenCalled();
  });
});

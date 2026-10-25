import { describe, expect, it, vi } from 'vitest';
import { staffAccessAllowed } from '../web/staff-access';

describe('staff workspace bootstrap: role check before showing private UI', () => {
  it('does not send a privileged request without a saved staff session', async () => {
    const read = vi.fn(async () => ({kind:'reviewer'}));
    expect(await staffAccessAllowed(false,read)).toBe(false);
    expect(read).not.toHaveBeenCalled();
  });

  it.each(['reviewer','office'])('accepts only server-confirmed %s', async kind => {
    expect(await staffAccessAllowed(true,async()=>({kind}))).toBe(true);
  });

  it.each(['citizen','admin','', 'unknown'])('denies unsupported role %s', async kind => {
    expect(await staffAccessAllowed(true,async()=>({kind}))).toBe(false);
  });

  it('denies malformed responses', async () => {
    expect(await staffAccessAllowed(true,async()=>({}))).toBe(false);
  });

  it.each([401,403,404,503])('does not display saved workspace after HTTP %s', async status => {
    expect(await staffAccessAllowed(true,async()=>{throw Object.assign(new Error('denied'),{status});})).toBe(false);
  });
});

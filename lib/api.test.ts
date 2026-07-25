/** @jest-environment node */
import { proxy, readJson } from './api';
import { BackendError } from './backend';

// api.ts -> backend.ts -> @/auth (NextAuth). Stub auth so importing doesn't
// pull the full provider config into this unit test.
jest.mock('@/auth', () => ({ auth: jest.fn() }));

describe('proxy', () => {
  it('returns 200 JSON on success', async () => {
    const res = await proxy(async () => ({ a: 1 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ a: 1 });
  });

  it('serializes a null result as JSON null', async () => {
    const res = await proxy(async () => undefined);
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it('maps a BackendError to its status and body', async () => {
    const res = await proxy(async () => {
      throw new BackendError(403, { error: 'forbidden' });
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'forbidden' });
  });

  it('maps an unexpected error to 500 without leaking details', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await proxy(async () => {
      throw new Error('boom secret');
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'internal_error' });
    spy.mockRestore();
  });
});

describe('readJson', () => {
  it('parses a JSON request body', async () => {
    const req = new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ reason: 'x' }),
      headers: { 'content-type': 'application/json' },
    });
    expect(await readJson(req)).toEqual({ reason: 'x' });
  });

  it('returns {} for an invalid/empty body', async () => {
    const req = new Request('http://x', { method: 'POST', body: 'not-json' });
    expect(await readJson(req)).toEqual({});
  });
});

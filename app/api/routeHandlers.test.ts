/** @jest-environment node */

/**
 * Coverage for the proxy route handlers themselves.
 *
 * This layer sits between the browser client (whose tests mock it away) and
 * FastAPI (whose tests bypass it), so it had no tests — and quietly dropped
 * fields from PATCH bodies as a result. These assert what actually reaches
 * the backend.
 */
import { backendFetch } from '@/lib/backend';

jest.mock('@/lib/backend', () => ({
  backendFetch: jest.fn(),
  BackendError: class BackendError extends Error {
    constructor(
      public status: number,
      public body: unknown,
    ) {
      super('backend error');
    }
  },
}));

const mockedFetch = backendFetch as unknown as jest.Mock;

const jsonRequest = (body: unknown) =>
  new Request('http://test/api', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  mockedFetch.mockReset().mockResolvedValue({ ok: true });
});

describe('PATCH /api/skills/:key', () => {
  async function patch(body: unknown) {
    const { PATCH } = await import('./skills/[key]/route');
    return PATCH(jsonRequest(body), { params: Promise.resolve({ key: 'route' }) });
  }

  it('forwards a toggle-only body', async () => {
    await patch({ enabled: false });
    expect(mockedFetch).toHaveBeenCalledWith('/qc/skills/route', {
      method: 'PATCH',
      body: { enabled: false },
    });
  });

  it('forwards a content edit without dropping fields', async () => {
    await patch({ name: 'Smart Routing', glyph: 'SR', desc: 'Picks approvers.' });
    expect(mockedFetch).toHaveBeenCalledWith('/qc/skills/route', {
      method: 'PATCH',
      body: { name: 'Smart Routing', glyph: 'SR', desc: 'Picks approvers.' },
    });
  });

  it('forwards a mixed edit', async () => {
    await patch({ name: 'Renamed', enabled: true });
    expect(mockedFetch.mock.calls[0][1].body).toEqual({ name: 'Renamed', enabled: true });
  });

  it('percent-encodes the key', async () => {
    const { PATCH } = await import('./skills/[key]/route');
    await PATCH(jsonRequest({ enabled: true }), { params: Promise.resolve({ key: 'a/b c' }) });
    expect(mockedFetch.mock.calls[0][0]).toBe('/qc/skills/a%2Fb%20c');
  });
});

describe('POST /api/skills', () => {
  it('forwards the whole new skill', async () => {
    const { POST } = await import('./skills/route');
    const skill = { key: 'dup', glyph: 'DC', name: 'Duplicate', desc: 'Finds repeats.', enabled: true };
    await POST(
      new Request('http://test/api/skills', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(skill),
      }),
    );
    expect(mockedFetch).toHaveBeenCalledWith('/qc/skills', { method: 'POST', body: skill });
  });
});

describe('routing flow handlers', () => {
  it('PUT forwards the whole flow definition', async () => {
    const { PUT } = await import('./routes/[type]/route');
    const flow = { meta: 'v1', mid: ['v'], high: ['v'], chain: ['a'], enabled: false, nodeVerify: { n0: false } };
    await PUT(
      new Request('http://test/api/routes/Pipeline1', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(flow),
      }),
      { params: Promise.resolve({ type: 'Pipeline1' }) },
    );
    expect(mockedFetch).toHaveBeenCalledWith('/qc/routing-flows/Pipeline1', { method: 'PUT', body: flow });
  });

  it('DELETE targets the named flow', async () => {
    const { DELETE } = await import('./routes/[type]/route');
    await DELETE(new Request('http://test/api/routes/Pipeline4', { method: 'DELETE' }), {
      params: Promise.resolve({ type: 'Pipeline4' }),
    });
    expect(mockedFetch).toHaveBeenCalledWith('/qc/routing-flows/Pipeline4', { method: 'DELETE' });
  });
});

describe('case decision handlers', () => {
  it('reject forwards the reason', async () => {
    const { POST } = await import('./cases/[id]/reject/route');
    await POST(
      new Request('http://test/api/cases/QC-1/reject', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'missing evidence' }),
      }),
      { params: Promise.resolve({ id: 'QC-1' }) },
    );
    expect(mockedFetch).toHaveBeenCalledWith('/qc/documents/QC-1/reject', {
      method: 'POST',
      body: { reason: 'missing evidence' },
    });
  });

  it('approve sends no body', async () => {
    const { POST } = await import('./cases/[id]/approve/route');
    await POST(new Request('http://test/api/cases/QC-1/approve', { method: 'POST' }), {
      params: Promise.resolve({ id: 'QC-1' }),
    });
    expect(mockedFetch).toHaveBeenCalledWith('/qc/documents/QC-1/approve', { method: 'POST' });
  });
});

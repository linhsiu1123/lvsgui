/** @jest-environment node */
import { backendFetch, BackendError } from './backend';
import { auth } from '@/auth';
import { isBackendConfigured } from '@/config/services';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/config/services', () => ({
  backendConfig: { baseUrl: 'https://backend.test', timeoutMs: 5000 },
  isBackendConfigured: jest.fn(() => true),
}));

const mockedAuth = auth as unknown as jest.Mock;
const mockedConfigured = isBackendConfigured as unknown as jest.Mock;

const okResponse = (body: unknown) =>
  Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(body == null ? '' : JSON.stringify(body)) });

describe('backendFetch', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    // Avoid leaving a real 5s abort timer pending after each test.
    jest.spyOn(AbortSignal, 'timeout').mockReturnValue(new AbortController().signal);
    mockedAuth.mockReset();
    mockedConfigured.mockReset().mockReturnValue(true);
  });

  afterEach(() => jest.restoreAllMocks());

  it('attaches the OIDC access token as a Bearer header (the security-critical path)', async () => {
    mockedAuth.mockResolvedValue({ accessToken: 'tok123' });
    fetchMock.mockReturnValue(okResponse({ ok: 1 }));

    await backendFetch('/qc/documents');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://backend.test/qc/documents');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok123');
  });

  it('rejects with 401 when there is no session/token', async () => {
    mockedAuth.mockResolvedValue(null);
    await expect(backendFetch('/x')).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects with 401 when the session carries a refresh error', async () => {
    mockedAuth.mockResolvedValue({ accessToken: 't', error: 'RefreshAccessTokenError' });
    await expect(backendFetch('/x')).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects with 500 when the backend base URL is not configured', async () => {
    mockedAuth.mockResolvedValue({ accessToken: 't' });
    mockedConfigured.mockReturnValue(false);
    await expect(backendFetch('/x')).rejects.toMatchObject({ status: 500 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('appends query params and skips undefined values', async () => {
    mockedAuth.mockResolvedValue({ accessToken: 't' });
    fetchMock.mockReturnValue(okResponse(null));
    await backendFetch('/q', { query: { type: 'Waiver Request', skip: undefined } });
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('type=Waiver+Request');
    expect(url).not.toContain('skip');
  });

  it('serializes a JSON body with a content-type header', async () => {
    mockedAuth.mockResolvedValue({ accessToken: 't' });
    fetchMock.mockReturnValue(okResponse({}));
    await backendFetch('/c', { method: 'POST', body: { reason: 'nope' } });
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ reason: 'nope' }));
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json');
  });

  it('throws BackendError carrying the status and parsed body on a non-2xx response', async () => {
    mockedAuth.mockResolvedValue({ accessToken: 't' });
    fetchMock.mockReturnValue(
      Promise.resolve({ ok: false, status: 422, text: () => Promise.resolve(JSON.stringify({ error: 'bad' })) }),
    );
    await expect(backendFetch('/c')).rejects.toMatchObject({ status: 422, body: { error: 'bad' } });
  });

  it('maps an upstream timeout to 504', async () => {
    mockedAuth.mockResolvedValue({ accessToken: 't' });
    const err = new Error('timed out');
    err.name = 'TimeoutError';
    fetchMock.mockRejectedValue(err);
    await expect(backendFetch('/c')).rejects.toMatchObject({ status: 504 });
  });

  it('maps a network failure to 502', async () => {
    mockedAuth.mockResolvedValue({ accessToken: 't' });
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(backendFetch('/c')).rejects.toMatchObject({ status: 502 });
  });

  it('BackendError exposes status and body', () => {
    const e = new BackendError(418, { teapot: true });
    expect(e).toBeInstanceOf(Error);
    expect(e.status).toBe(418);
    expect(e.body).toEqual({ teapot: true });
  });
});

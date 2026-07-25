/** @jest-environment node */
import { api, ApiError } from './api-client';

const jsonRes = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, text: () => Promise.resolve(JSON.stringify(body)) });

describe('api-client', () => {
  let fetchMock: jest.Mock;
  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('returns the parsed body on success', async () => {
    fetchMock.mockReturnValue(jsonRes([{ id: 'QC-1' }]));
    await expect(api.cases.list()).resolves.toEqual([{ id: 'QC-1' }]);
  });

  it('encodes the optional type filter into the query string', async () => {
    fetchMock.mockReturnValue(jsonRes([]));
    await api.cases.list('Waiver Request');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/cases?type=Waiver%20Request');
  });

  it('sends a POST with the reason body on reject', async () => {
    fetchMock.mockReturnValue(jsonRes({ id: 'QC-1' }));
    await api.cases.reject('QC-1', 'insufficient evidence');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/cases/QC-1/reject');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ reason: 'insufficient evidence' });
  });

  it('sends a PATCH with the enabled flag on skill toggle', async () => {
    fetchMock.mockReturnValue(jsonRes({ key: 'auto' }));
    await api.skills.toggle('auto', false);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/skills/auto');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ enabled: false });
  });

  it('throws a 401 ApiError when unauthenticated', async () => {
    fetchMock.mockReturnValue(jsonRes({ error: 'unauthorized' }, 401));
    await expect(api.activity.list()).rejects.toMatchObject({ status: 401 });
  });

  it('throws an ApiError carrying the backend error message on failure', async () => {
    fetchMock.mockReturnValue(jsonRes({ error: 'boom' }, 500));
    await expect(api.routes.list()).rejects.toMatchObject({ status: 500, message: 'boom' });
    expect(new ApiError(400, 'x')).toBeInstanceOf(Error);
  });
});

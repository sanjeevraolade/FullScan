import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError, apiRequest, setUnauthorizedListener } from './client';

const itemSchema = z.object({ id: z.string() });

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('apiRequest', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const onUnauthorized = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    setUnauthorizedListener(onUnauthorized);
  });

  afterEach(() => {
    fetchMock.mockReset();
    onUnauthorized.mockReset();
    setUnauthorizedListener(null);
    vi.unstubAllGlobals();
  });

  it('unwraps and validates the envelope, sending same-origin credentials', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { success: true, data: { id: 'x' } }));

    await expect(apiRequest('/cases', itemSchema)).resolves.toEqual({ id: 'x' });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/fe-web/cases',
      expect.objectContaining({ credentials: 'same-origin', method: 'GET' }),
    );
  });

  it('serialises JSON bodies', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { success: true, data: { id: 'x' } }));

    await apiRequest('/auth/login', itemSchema, { method: 'POST', body: { username: 'fe001' }, isAuthRequest: true });

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.body).toBe('{"username":"fe001"}');
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' });
  });

  it('surfaces the server error message and status', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(429, { success: false, error: 'Too many attempts' }));

    await expect(apiRequest('/auth/login', itemSchema, { isAuthRequest: true })).rejects.toMatchObject({
      status: 429,
      message: 'Too many attempts',
    });
  });

  it('rejects a response that does not match the schema', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { success: true, data: { id: 42 } }));

    await expect(apiRequest('/cases', itemSchema)).rejects.toBeInstanceOf(ApiError);
  });

  it('reports network failures as status 0', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const error = await apiRequest('/cases', itemSchema).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error instanceof ApiError && error.isNetworkError).toBe(true);
  });

  it('retries once when the session turns out to be valid again after a 401', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { success: false, error: 'Invalid or expired session' }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true, data: { id: 'fe-001' } }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true, data: { id: 'x' } }));

    await expect(apiRequest('/cases', itemSchema)).resolves.toEqual({ id: 'x' });
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/api/v1/fe-web/cases',
      '/api/v1/fe-web/auth/me',
      '/api/v1/fe-web/cases',
    ]);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('ends the session when the 401 cannot be recovered', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { success: false, error: 'Invalid or expired session' }))
      .mockResolvedValueOnce(jsonResponse(401, { success: false, error: 'Missing session' }));

    await expect(apiRequest('/cases', itemSchema)).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('shares one session probe between concurrent 401s', async () => {
    fetchMock.mockImplementation(async (input) =>
      String(input).endsWith('/auth/me')
        ? jsonResponse(401, { success: false, error: 'Missing session' })
        : jsonResponse(401, { success: false, error: 'Invalid or expired session' }),
    );

    await Promise.allSettled([apiRequest('/cases', itemSchema), apiRequest('/profile', itemSchema)]);

    expect(fetchMock.mock.calls.filter((call) => String(call[0]).endsWith('/auth/me'))).toHaveLength(1);
  });

  it('treats a 401 from an auth endpoint as an answer, not an expired session', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { success: false, error: 'Invalid username or password' }));

    await expect(apiRequest('/auth/login', itemSchema, { isAuthRequest: true })).rejects.toMatchObject({
      status: 401,
      message: 'Invalid username or password',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});

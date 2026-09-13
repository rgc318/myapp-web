import { logoutMyAppJwt, refreshMyAppJwt } from '../auth';
import {
  clearMyAppTokens,
  loadMyAppTokens,
  saveMyAppTokens,
} from '../auth-storage';

describe('JWT refresh concurrency', () => {
  const originalFetch = global.fetch;
  let resolveFetch: (value: Response) => void;

  beforeEach(() => {
    window.localStorage.clear();
    saveMyAppTokens({ accessToken: 'old-access', refreshToken: 'old-refresh' });
    global.fetch = jest.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function respond(ok: boolean) {
    resolveFetch({
      ok,
      status: ok ? 200 : 401,
      json: async () => ({
        message: {
          data: {
            access_token: 'rotated-access',
            refresh_token: 'rotated-refresh',
          },
        },
      }),
    } as Response);
  }

  it('shares one refresh request among concurrent callers', async () => {
    const first = refreshMyAppJwt();
    const second = refreshMyAppJwt();
    expect(first).toBe(second);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    respond(true);
    expect(await Promise.all([first, second])).toEqual([true, true]);
    expect(loadMyAppTokens().refreshToken).toBe('rotated-refresh');
  });

  it.each([
    true,
    false,
  ])('does not replace a newer login after old response ok=%s', async (ok) => {
    const pending = refreshMyAppJwt();
    saveMyAppTokens({ accessToken: 'new-login', refreshToken: 'new-session' });
    respond(ok);
    expect(await pending).toBe(true);
    expect(loadMyAppTokens().accessToken).toBe('new-login');
  });

  it('does not restore tokens after logout', async () => {
    const pending = refreshMyAppJwt();
    clearMyAppTokens();
    respond(true);
    expect(await pending).toBe(false);
    expect(loadMyAppTokens().accessToken).toBeNull();
  });

  it('clears the matching invalid session and allows later refreshes', async () => {
    const pending = refreshMyAppJwt();
    respond(false);
    expect(await pending).toBe(false);
    expect(loadMyAppTokens().refreshToken).toBeNull();
    saveMyAppTokens({ accessToken: 'old-access', refreshToken: 'old-refresh' });
    const retry = refreshMyAppJwt();
    expect(global.fetch).toHaveBeenCalledTimes(2);
    respond(true);
    expect(await retry).toBe(true);
  });

  it('preserves tokens on a temporary server failure', async () => {
    const pending = refreshMyAppJwt();
    resolveFetch({
      ok: false,
      status: 503,
      json: async () => ({}),
    } as Response);
    await expect(pending).rejects.toMatchObject({ status: 503 });
    expect(loadMyAppTokens().refreshToken).toBe('old-refresh');
  });

  it('preserves tokens when a successful HTTP response contains no token pair', async () => {
    const pending = refreshMyAppJwt();
    resolveFetch({ ok: true, status: 200, json: async () => ({}) } as Response);
    await expect(pending).rejects.toMatchObject({ status: 502 });
    expect(loadMyAppTokens().refreshToken).toBe('old-refresh');
  });

  it.each([
    true,
    false,
  ])('clears logout locally without destroying a newer login, response ok=%s', async (ok) => {
    const pending = logoutMyAppJwt();
    expect(loadMyAppTokens().accessToken).toBeNull();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer old-access',
        }),
        body: JSON.stringify({ refresh_token: 'old-refresh' }),
      }),
    );
    saveMyAppTokens({ accessToken: 'new-login', refreshToken: 'new-session' });
    respond(ok);
    if (ok) await pending;
    else await expect(pending).rejects.toMatchObject({ status: 401 });
    expect(loadMyAppTokens().accessToken).toBe('new-login');
  });

  it('aborts a stalled refresh without clearing the session or leaking a timer', async () => {
    jest.useFakeTimers();
    try {
      global.fetch = jest.fn(
        (_url, options) =>
          new Promise((_resolve, reject) => {
            options?.signal?.addEventListener(
              'abort',
              () => reject(new DOMException('Aborted', 'AbortError')),
              { once: true },
            );
          }),
      );
      const pending = refreshMyAppJwt();
      const assertion = expect(pending).rejects.toMatchObject({
        name: 'AbortError',
      });
      await jest.advanceTimersByTimeAsync(30_000);
      await assertion;
      expect(loadMyAppTokens().refreshToken).toBe('old-refresh');
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('cross-tab refresh coordination', () => {
  const originalFetch = global.fetch;
  const originalLocks = Object.getOwnPropertyDescriptor(navigator, 'locks');

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalLocks) Object.defineProperty(navigator, 'locks', originalLocks);
    else Reflect.deleteProperty(navigator, 'locks');
  });

  it('times out waiting for another tab without sending HTTP or clearing tokens', async () => {
    window.localStorage.clear();
    saveMyAppTokens({ accessToken: 'access', refreshToken: 'refresh' });
    global.fetch = jest.fn();
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: {
        request: (_name: string, options: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            options.signal.addEventListener(
              'abort',
              () => reject(new DOMException('Aborted', 'AbortError')),
              { once: true },
            );
          }),
      },
    });
    jest.useFakeTimers();
    try {
      const assertion = expect(refreshMyAppJwt()).rejects.toMatchObject({
        name: 'AbortError',
      });
      await jest.advanceTimersByTimeAsync(30_000);
      await assertion;
      expect(global.fetch).not.toHaveBeenCalled();
      expect(loadMyAppTokens().refreshToken).toBe('refresh');
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('rotates once across independent module instances sharing a Web Lock', async () => {
    window.localStorage.clear();
    saveMyAppTokens({ accessToken: 'old-access', refreshToken: 'old-refresh' });
    let queue = Promise.resolve();
    const request = jest.fn((_name, _options, callback) => {
      const result = queue.then(callback);
      queue = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    });
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request },
    });
    let resolveResponse: (response: Response) => void = () => {};
    global.fetch = jest.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveResponse = resolve;
        }),
    );
    let otherTabRefresh = refreshMyAppJwt;
    jest.isolateModules(() => {
      otherTabRefresh = require('../auth').refreshMyAppJwt;
    });
    const first = refreshMyAppJwt();
    const second = otherTabRefresh();
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    resolveResponse({
      ok: true,
      status: 200,
      json: async () => ({
        message: {
          data: {
            access_token: 'new-access',
            refresh_token: 'new-refresh',
          },
        },
      }),
    } as Response);
    expect(await Promise.all([first, second])).toEqual([true, true]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(loadMyAppTokens().refreshToken).toBe('new-refresh');
    expect(request.mock.calls[0][0]).toBe('myapp-web.jwt-refresh');
  });
});

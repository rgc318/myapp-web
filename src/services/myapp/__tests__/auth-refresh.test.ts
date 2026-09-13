import { refreshMyAppJwt } from '../auth';
import { clearMyAppTokens, loadMyAppTokens, saveMyAppTokens } from '../auth-storage';

describe('JWT refresh concurrency', () => {
  const originalFetch = global.fetch;
  let resolveFetch: (value: Response) => void;

  beforeEach(() => {
    window.localStorage.clear();
    saveMyAppTokens({ accessToken: 'old-access', refreshToken: 'old-refresh' });
    global.fetch = jest.fn(() => new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    }));
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function respond(ok: boolean) {
    resolveFetch({
      ok,
      status: ok ? 200 : 401,
      json: async () => ({ message: { data: {
        access_token: 'rotated-access', refresh_token: 'rotated-refresh',
      } } }),
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

  it.each([true, false])('does not replace a newer login after old response ok=%s', async (ok) => {
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
});

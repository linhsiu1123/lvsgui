/** @jest-environment node */

const ORIGINAL_ENV = process.env;

/** Re-import the module under a fresh env so its module-level state resets. */
async function loadWith(env: Record<string, string | undefined>) {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV, ...env };
  return import('./auth-mode');
}

afterEach(() => {
  process.env = ORIGINAL_ENV;
  jest.restoreAllMocks();
});

describe('isAuthBypassEnabled', () => {
  it('is off unless the flag is explicitly "true"', async () => {
    for (const AUTH_BYPASS of [undefined, '', 'false', '1', 'yes', 'TRUE']) {
      const { isAuthBypassEnabled } = await loadWith({ AUTH_BYPASS, NODE_ENV: 'development' });
      expect(isAuthBypassEnabled()).toBe(false);
    }
  });

  it('is on in development when explicitly enabled', async () => {
    const { isAuthBypassEnabled } = await loadWith({ AUTH_BYPASS: 'true', NODE_ENV: 'development' });
    expect(isAuthBypassEnabled()).toBe(true);
  });

  it('refuses to bypass in a production build, and says so loudly', async () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { isAuthBypassEnabled } = await loadWith({ AUTH_BYPASS: 'true', NODE_ENV: 'production' });

    expect(isAuthBypassEnabled()).toBe(false);
    expect(err).toHaveBeenCalledWith(expect.stringContaining('IGNORED'));

    // repeated calls stay false; the alarm is not re-spammed per request
    expect(isAuthBypassEnabled()).toBe(false);
    expect(err).toHaveBeenCalledTimes(1);
  });
});

describe('debug identity + token', () => {
  it('falls back to a generic local identity', async () => {
    const { debugIdentity } = await loadWith({ AUTH_BYPASS_USER: undefined, AUTH_BYPASS_EMAIL: undefined });
    expect(debugIdentity()).toEqual({ name: 'Debug User', email: 'debug@localhost' });
  });

  it('honours the configured identity', async () => {
    const { debugIdentity } = await loadWith({ AUTH_BYPASS_USER: 'Lin', AUTH_BYPASS_EMAIL: 'lin@lvs.test' });
    expect(debugIdentity()).toEqual({ name: 'Lin', email: 'lin@lvs.test' });
  });

  it('treats an empty bypass token as absent', async () => {
    const { debugAccessToken } = await loadWith({ AUTH_BYPASS_TOKEN: '' });
    expect(debugAccessToken()).toBeUndefined();
  });

  it('returns the bypass token when one is set', async () => {
    const { debugAccessToken } = await loadWith({ AUTH_BYPASS_TOKEN: 'tok-debug' });
    expect(debugAccessToken()).toBe('tok-debug');
  });
});

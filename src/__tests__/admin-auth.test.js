import { afterEach, describe, expect, it } from 'vitest';
import { createSessionCookie, isAuthenticated } from '../../api/_lib/admin.js';

const original = {
  username: process.env.ADMIN_USERNAME,
  password: process.env.ADMIN_PASSWORD,
  secret: process.env.ADMIN_SESSION_SECRET,
  nodeEnv: process.env.NODE_ENV,
};

function configure() {
  process.env.ADMIN_USERNAME = 'test-admin';
  process.env.ADMIN_PASSWORD = 'not-used-by-session-test';
  process.env.ADMIN_SESSION_SECRET = 'test-secret-that-is-at-least-32-characters-long';
  process.env.NODE_ENV = 'test';
}

afterEach(() => {
  for (const [key, value] of Object.entries({ ADMIN_USERNAME: original.username, ADMIN_PASSWORD: original.password, ADMIN_SESSION_SECRET: original.secret, NODE_ENV: original.nodeEnv })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('admin session signing', () => {
  it('accepts a correctly signed, unexpired HttpOnly session cookie', () => {
    configure();
    const cookie = createSessionCookie('test-admin').split(';')[0];
    const req = { headers: { cookie } };
    expect(isAuthenticated(req)).toBe(true);
  });

  it('rejects a modified session cookie', () => {
    configure();
    const cookie = createSessionCookie('test-admin').split(';')[0];
    const req = { headers: { cookie: `${cookie.slice(0, -1)}x` } };
    expect(isAuthenticated(req)).toBe(false);
  });

  it('rejects a session when the configured admin identity changes', () => {
    configure();
    const cookie = createSessionCookie('test-admin').split(';')[0];
    process.env.ADMIN_USERNAME = 'another-admin';
    expect(isAuthenticated({ headers: { cookie } })).toBe(false);
  });
});

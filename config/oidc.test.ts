/** @jest-environment node */
import { assertOidcConfigured, isOidcConfigured, isPublicClient } from './oidc';

describe('OIDC config guards', () => {
  const ORIGINAL_ENV = process.env;
  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('assertOidcConfigured throws and names every missing Keycloak var', () => {
    process.env = { ...ORIGINAL_ENV, KEYCLOAK_ISSUER: '', KEYCLOAK_CLIENT_ID: '' };
    expect(() => assertOidcConfigured()).toThrow(/KEYCLOAK_ISSUER/);
    expect(() => assertOidcConfigured()).toThrow(/KEYCLOAK_CLIENT_ID/);
  });

  it('assertOidcConfigured passes for a public client, with no secret set', () => {
    process.env = {
      ...ORIGINAL_ENV,
      KEYCLOAK_ISSUER: 'https://kc.example.com/realms/lvs',
      KEYCLOAK_CLIENT_ID: 'lvs-web',
      KEYCLOAK_CLIENT_SECRET: '',
    };
    expect(() => assertOidcConfigured()).not.toThrow();
  });

  it('isOidcConfigured reports false when Keycloak env is absent (test default)', () => {
    // Values are captured at import; the test env has no Keycloak vars set.
    expect(isOidcConfigured()).toBe(false);
  });

  it('treats a missing client secret as a public (PKCE) client', () => {
    // Captured at import time, where the test env sets no secret.
    expect(isPublicClient()).toBe(true);
  });
});

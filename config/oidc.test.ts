/** @jest-environment node */
import { assertOidcConfigured, isOidcConfigured } from './oidc';

describe('OIDC config guards', () => {
  const ORIGINAL_ENV = process.env;
  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('assertOidcConfigured throws and names every missing Keycloak var', () => {
    process.env = { ...ORIGINAL_ENV, KEYCLOAK_ISSUER: '', KEYCLOAK_CLIENT_ID: '', KEYCLOAK_CLIENT_SECRET: '' };
    expect(() => assertOidcConfigured()).toThrow(/KEYCLOAK_ISSUER/);
    expect(() => assertOidcConfigured()).toThrow(/KEYCLOAK_CLIENT_ID/);
    expect(() => assertOidcConfigured()).toThrow(/KEYCLOAK_CLIENT_SECRET/);
  });

  it('assertOidcConfigured passes when all vars are present', () => {
    process.env = {
      ...ORIGINAL_ENV,
      KEYCLOAK_ISSUER: 'https://kc.example.com/realms/lvs',
      KEYCLOAK_CLIENT_ID: 'lvs-web',
      KEYCLOAK_CLIENT_SECRET: 'secret',
    };
    expect(() => assertOidcConfigured()).not.toThrow();
  });

  it('isOidcConfigured reports false when Keycloak env is absent (test default)', () => {
    // Values are captured at import; the test env has no Keycloak vars set.
    expect(isOidcConfigured()).toBe(false);
  });
});

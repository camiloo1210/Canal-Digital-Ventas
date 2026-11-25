import { describe, expect, it } from 'vitest';
import { readShipmentCreationConfig } from '@/worker/shipment-creation-config';
import { describeStartupFailure } from '@/worker/shipment-creation-startup';

const TENANT = '11111111-1111-4111-8111-111111111111';
const valid: Record<string, string> = {
  NODE_ENV: 'production',
  SHIPMENT_CREATION_SANDBOX_ENABLED: 'true',
  SHIPMENT_CREATION_DATABASE_URL: 'postgres://worker:pw@test/database',
  PRODUCTION_DATABASE_URL: 'postgres://prod/database',
  TRACKING_DEPLOYMENT_ID: '22222222-2222-4222-8222-222222222222',
  TRACKING_CREDENTIALS_JSON: '{"store":{"clientId":"id","clientSecret":"topsecret"}}',
  FEDEX_SANDBOX_ACCOUNT_NUMBER: '123456789',
  FEDEX_SERVICE_TYPE: 'FEDEX_GROUND',
  SHIPMENT_CREATION_TENANT_REFS_JSON: `{"${TENANT}":"store"}`,
  SHIPMENT_CREATION_SYSTEM_ACTOR_ID: '33333333-3333-4333-8333-333333333333',
  SHIPMENT_CREATION_LABELS_SUPABASE_URL: 'https://example.supabase.co',
  SHIPMENT_CREATION_LABELS_SERVICE_ROLE_KEY: 'service-role-key-value',
};

function describeConfigFailure(env: Record<string, string>): string {
  try {
    readShipmentCreationConfig(env);
  } catch (error: unknown) {
    return describeStartupFailure(error);
  }
  return expect.unreachable();
}

function without(name: string): Record<string, string> {
  const copy = { ...valid };
  delete copy[name];
  return copy;
}

describe('shipment creation worker configuration', (): void => {
  it.each([
    {},
    { SHIPMENT_CREATION_SANDBOX_ENABLED: '' },
    { SHIPMENT_CREATION_SANDBOX_ENABLED: 'false' },
    { SHIPMENT_CREATION_SANDBOX_ENABLED: 'TRUE' },
  ])('is disabled (null) unless exactly true: %o', (env): void => {
    expect(readShipmentCreationConfig(env)).toBeNull();
  });

  it('parses a valid configuration with defaults', (): void => {
    const config = readShipmentCreationConfig(valid);
    expect(config).not.toBeNull();
    expect(config?.credentials.store?.clientId).toBe('id');
    expect(config?.tenantRefs[TENANT]).toBe('store');
    expect(config?.pollIntervalMs).toBe(5000);
    expect(config?.leaseSeconds).toBe(180);
    expect(config?.serviceType).toBe('FEDEX_GROUND');
    expect(config?.productionDatabaseUrl).toBe('postgres://prod/database');
  });

  it.each([
    'SHIPMENT_CREATION_DATABASE_URL',
    'TRACKING_DEPLOYMENT_ID',
    'TRACKING_CREDENTIALS_JSON',
    'FEDEX_SANDBOX_ACCOUNT_NUMBER',
    'FEDEX_SERVICE_TYPE',
    'SHIPMENT_CREATION_TENANT_REFS_JSON',
    'SHIPMENT_CREATION_SYSTEM_ACTOR_ID',
    'SHIPMENT_CREATION_LABELS_SUPABASE_URL',
    'SHIPMENT_CREATION_LABELS_SERVICE_ROLE_KEY',
  ])('throws a generic error when %s is missing', (name): void => {
    expect((): unknown => readShipmentCreationConfig(without(name))).toThrow(
      'Invalid sandbox shipment creation worker configuration',
    );
  });

  it.each([
    'SHIPMENT_CREATION_DATABASE_URL',
    'TRACKING_DEPLOYMENT_ID',
    'TRACKING_CREDENTIALS_JSON',
    'FEDEX_SANDBOX_ACCOUNT_NUMBER',
    'FEDEX_SERVICE_TYPE',
    'SHIPMENT_CREATION_TENANT_REFS_JSON',
    'SHIPMENT_CREATION_SYSTEM_ACTOR_ID',
    'SHIPMENT_CREATION_LABELS_SUPABASE_URL',
    'SHIPMENT_CREATION_LABELS_SERVICE_ROLE_KEY',
  ])('names only the variable %s when it is missing', (name): void => {
    const error = describeConfigFailure(without(name));
    expect(error).toBe(
      `Sandbox shipment creation worker stopped at stage "config" (variable ${name}); check configuration and permissions.`,
    );
  });

  it.each([
    [{ SHIPMENT_CREATION_SYSTEM_ACTOR_ID: 'not-a-uuid' }, 'SHIPMENT_CREATION_SYSTEM_ACTOR_ID'],
    [{ TRACKING_DEPLOYMENT_ID: 'not-a-uuid' }, 'TRACKING_DEPLOYMENT_ID'],
    [{ SHIPMENT_CREATION_LABELS_SUPABASE_URL: 'ftp://x' }, 'SHIPMENT_CREATION_LABELS_SUPABASE_URL'],
    [{ TRACKING_CREDENTIALS_JSON: '{bad' }, 'TRACKING_CREDENTIALS_JSON'],
    [{ SHIPMENT_CREATION_TENANT_REFS_JSON: '{bad' }, 'SHIPMENT_CREATION_TENANT_REFS_JSON'],
    [
      { SHIPMENT_CREATION_TENANT_REFS_JSON: `{"${TENANT}":"unknown"}` },
      'SHIPMENT_CREATION_TENANT_REFS_JSON',
    ],
    [{ SHIPMENT_CREATION_LEASE_SECONDS: '120' }, 'SHIPMENT_CREATION_LEASE_SECONDS'],
    [{ SHIPMENT_CREATION_POLL_INTERVAL_MS: '999' }, 'SHIPMENT_CREATION_POLL_INTERVAL_MS'],
  ])('names the invalid variable for %o', (override, name): void => {
    expect(describeConfigFailure({ ...valid, ...override })).toContain(`(variable ${name})`);
  });

  it('never prints a configured value while naming the variable', (): void => {
    const line = describeConfigFailure({
      ...valid,
      TRACKING_CREDENTIALS_JSON: '{"store": topsecret',
    });
    expect(line).not.toContain('topsecret');
    expect(line).not.toContain('postgres://');
  });

  it('does not echo secret values in the error', (): void => {
    try {
      readShipmentCreationConfig({ ...valid, SHIPMENT_CREATION_SYSTEM_ACTOR_ID: 'topsecret' });
      expect.unreachable();
    } catch (error: unknown) {
      expect(String(error)).not.toContain('topsecret');
      expect(String(error)).not.toContain('pw');
    }
  });

  it.each([
    { SHIPMENT_CREATION_LEASE_SECONDS: '120' },
    { SHIPMENT_CREATION_LEASE_SECONDS: '179' },
    { SHIPMENT_CREATION_LEASE_SECONDS: 'abc' },
    { SHIPMENT_CREATION_LEASE_SECONDS: '3601' },
    { SHIPMENT_CREATION_POLL_INTERVAL_MS: '999' },
    { SHIPMENT_CREATION_SYSTEM_ACTOR_ID: 'not-a-uuid' },
    { SHIPMENT_CREATION_TENANT_REFS_JSON: '{}' },
    { SHIPMENT_CREATION_TENANT_REFS_JSON: '[]' },
    { SHIPMENT_CREATION_TENANT_REFS_JSON: '{"not-a-uuid":"store"}' },
    { SHIPMENT_CREATION_TENANT_REFS_JSON: `{"${TENANT}":"bad ref!"}` },
    { SHIPMENT_CREATION_TENANT_REFS_JSON: `{"${TENANT}":"unknown"}` },
    { SHIPMENT_CREATION_TENANT_REFS_JSON: '{bad' },
    { TRACKING_CREDENTIALS_JSON: '{}' },
    { TRACKING_DEPLOYMENT_ID: 'not-a-uuid' },
    { SHIPMENT_CREATION_LABELS_SUPABASE_URL: 'ftp://x' },
  ])('rejects unsafe configuration %o', (override): void => {
    expect((): unknown => readShipmentCreationConfig({ ...valid, ...override })).toThrow(
      'Invalid sandbox shipment creation worker configuration',
    );
  });

  it('accepts explicit lease and poll interval within bounds', (): void => {
    const config = readShipmentCreationConfig({
      ...valid,
      SHIPMENT_CREATION_LEASE_SECONDS: '180',
      SHIPMENT_CREATION_POLL_INTERVAL_MS: '1000',
    });
    expect(config?.leaseSeconds).toBe(180);
    expect(config?.pollIntervalMs).toBe(1000);
  });
});

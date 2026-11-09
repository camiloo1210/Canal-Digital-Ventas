import { describe, expect, it } from 'vitest';
import {
  isTrackingSandboxEnabled,
  readTrackingWorkerConfig,
} from '@/worker/shipment-tracking-config';

describe('shipment tracking worker configuration', (): void => {
  it.each([{}, { TRACKING_SANDBOX_ENABLED: '' }, { TRACKING_SANDBOX_ENABLED: 'false' }])(
    'stays disabled unless explicitly enabled %o',
    (env): void => {
      expect(isTrackingSandboxEnabled(env)).toBe(false);
    },
  );
  it('is enabled only by the exact value true', (): void => {
    expect(isTrackingSandboxEnabled({ TRACKING_SANDBOX_ENABLED: 'true' })).toBe(true);
    expect(isTrackingSandboxEnabled({ TRACKING_SANDBOX_ENABLED: 'TRUE' })).toBe(false);
  });
  const valid = {
    NODE_ENV: 'production',
    TRACKING_SANDBOX_ENABLED: 'true',
    TRACKING_DATABASE_URL: 'postgres://test/database',
    PRODUCTION_DATABASE_URL: 'postgres://prod/database',
    TRACKING_DEPLOYMENT_ID: 'id',
    TRACKING_CREDENTIALS_JSON: '{"store":{"clientId":"id","clientSecret":"secret"}}',
  };
  it('parses credentials without merging tenants', (): void => {
    const config = readTrackingWorkerConfig(valid);
    expect(config.credentials.store?.clientId).toBe('id');
    expect(config.credentials.other).toBeUndefined();
  });
  it.each([
    { TRACKING_SANDBOX_ENABLED: '' },
    { TRACKING_DATABASE_URL: '' },
    { TRACKING_CREDENTIALS_JSON: '{}' },
  ])('rejects unsafe configuration %o', (override): void => {
    expect((): void => {
      readTrackingWorkerConfig({ ...valid, ...override });
    }).toThrow();
  });
  it('does not require a production database when none exists yet', (): void => {
    expect(
      readTrackingWorkerConfig({ ...valid, PRODUCTION_DATABASE_URL: '' }).productionDatabaseUrl,
    ).toBe('');
  });
});

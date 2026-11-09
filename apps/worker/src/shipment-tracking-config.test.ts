import { describe, expect, it } from 'vitest';
import { readTrackingWorkerConfig } from '@/worker/shipment-tracking-config';

describe('shipment tracking worker configuration', (): void => {
  const valid = {
    NODE_ENV: 'production',
    TRACKING_SANDBOX_ENABLED: 'true',
    APP_ENV: 'test',
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
    { APP_ENV: 'production' },
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

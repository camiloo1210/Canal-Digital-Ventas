import { describe, expect, it } from 'vitest';
import { isShipmentCreationEnabled } from '@/features/orders/server/shipment-creation-sandbox-config';

const good = {
  NODE_ENV: 'production',
  TRACKING_SANDBOX_ENABLED: 'true',
  SHIPMENT_CREATION_SANDBOX_ENABLED: 'true',
  DATABASE_URL: 'postgres://test/db',
  PRODUCTION_DATABASE_URL: 'postgres://prod/db',
  TRACKING_DEPLOYMENT_ID: '00000000-0000-4000-8000-000000000001',
  TRACKING_TENANT_REFS_JSON: '{"tenant":"ref"}',
};

describe('web shipment creation switch', (): void => {
  it('is enabled only with the exact flag and a valid sandbox tracking config', (): void => {
    expect(isShipmentCreationEnabled(good)).toBe(true);
  });
  it.each(['', 'false', 'TRUE', '1', ' true', undefined])(
    'stays disabled when the flag is %s',
    (flag): void => {
      expect(isShipmentCreationEnabled({ ...good, SHIPMENT_CREATION_SANDBOX_ENABLED: flag })).toBe(
        false,
      );
    },
  );
  it('stays disabled without the sandbox tracking configuration', (): void => {
    expect(isShipmentCreationEnabled({ ...good, TRACKING_SANDBOX_ENABLED: 'false' })).toBe(false);
    expect(isShipmentCreationEnabled({ ...good, TRACKING_DEPLOYMENT_ID: '' })).toBe(false);
    expect(isShipmentCreationEnabled({ ...good, PRODUCTION_DATABASE_URL: good.DATABASE_URL })).toBe(
      false,
    );
  });
});

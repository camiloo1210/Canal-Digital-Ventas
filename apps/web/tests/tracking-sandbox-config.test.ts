import { describe, expect, it } from 'vitest';
import { trackingSandboxConfig } from '@/features/orders/server/tracking-sandbox-config';
const good = {
  NODE_ENV: 'production',
  TRACKING_SANDBOX_ENABLED: 'true',
  DATABASE_URL: 'postgres://test/db',
  PRODUCTION_DATABASE_URL: 'postgres://prod/db',
  TRACKING_DEPLOYMENT_ID: '00000000-0000-4000-8000-000000000001',
  TRACKING_TENANT_REFS_JSON: '{"tenant":"ref"}',
};
describe('web sandbox tracking configuration', (): void => {
  it('disables tracking without explicit activation and for the same database', (): void => {
    expect(trackingSandboxConfig({ ...good, TRACKING_SANDBOX_ENABLED: '' })).toBeNull();
    expect(
      trackingSandboxConfig({ ...good, PRODUCTION_DATABASE_URL: good.DATABASE_URL }),
    ).toBeNull();
  });
  it('selects the credential reference for the correct tenant only', (): void => {
    const config = trackingSandboxConfig(good);
    expect(config?.refs.tenant).toBe('ref');
    expect(config?.refs.other).toBeUndefined();
  });
  it('allows sandbox in a production build without an official production database', (): void => {
    expect(trackingSandboxConfig({ ...good, PRODUCTION_DATABASE_URL: '' })?.refs.tenant).toBe(
      'ref',
    );
  });
});

import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('legacy RPC grant migration publication order', (): void => {
  it('publishes authorization hardening after the existing remote migration boundary', (): void => {
    const migrations = readdirSync(resolve('supabase/migrations'));
    const authorization = migrations.filter((file): boolean =>
      file.endsWith('_security_authorization_boundaries.sql'),
    );
    expect(authorization).toHaveLength(1);
    expect(Number(authorization[0].slice(0, 14))).toBeGreaterThan(20261107000000);
  });

  it('follows the cart-currency migration committed before this remediation', (): void => {
    const migrations = readdirSync(resolve('supabase/migrations'));
    const revocation = migrations.find((file): boolean =>
      file.endsWith('_close_legacy_browser_rpc_grants.sql'),
    );
    expect(migrations).toContain('20261107000000_cart_currency.sql');
    expect(revocation).toBeDefined();
    expect(Number(revocation!.slice(0, 14))).toBeGreaterThan(20261107000000);
  });
});

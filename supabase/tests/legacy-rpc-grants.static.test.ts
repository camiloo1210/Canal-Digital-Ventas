import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('legacy RPC grant migration publication order', (): void => {
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

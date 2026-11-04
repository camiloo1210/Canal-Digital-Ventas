import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..');

function walk(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (entry === 'node_modules' || entry === '.next') continue;
    if (statSync(full).isDirectory()) walk(full, found);
    else if (/\.(ts|tsx)$/.test(entry)) found.push(full);
  }
  return found;
}

const features = walk(path.join(root, 'features'));
const actionFiles = features.filter((file): boolean => /[\\/]actions[\\/][^\\/]+\.ts$/.test(file));

/** Dashboard mutations that must carry the business they act on (hidden field or explicit argument). */
const TENANT_SCOPED_ACTION_MODULES: readonly string[] = [
  'categories/actions/categories.actions',
  'products/actions/products.actions',
  'products/actions/product-image-uploads.actions',
  'orders/actions/change-order-status.actions',
  'store-settings/actions/store-settings.actions',
  'kivi/actions/kivi-connection.actions',
  'kivi/actions/kivi-whatsapp.actions',
  'kivi/actions/kivi-notifications.actions',
  'kivi/actions/kivi-knowledge.actions',
  'users/actions/roles.actions',
  'users/actions/members.actions',
  'users/actions/invitations.actions',
];

describe('explicit business on every dashboard mutation', (): void => {
  it('no server action infers the business from the user (cookie or single membership)', (): void => {
    const offenders = actionFiles.filter((file): boolean => {
      const source = readFileSync(file, 'utf8');
      return /getActiveTenantQuery|getActiveTenantContextQuery/.test(source);
    });
    expect(offenders.map((file): string => path.relative(root, file))).toEqual([]);
  });

  it.each(TENANT_SCOPED_ACTION_MODULES)(
    '%s verifies the named business through the shared resolver',
    (module): void => {
      const source = readFileSync(path.join(root, 'features', module + '.ts'), 'utf8');
      expect(source).toMatch(/resolveActionTenant|resolveUsersActor/);
      expect(source).not.toMatch(/active_tenant|readActiveTenantCookie/);
    },
  );

  it('every component that submits a tenant-scoped action renders the business field or reads it', (): void => {
    const consumers = features.filter((file): boolean => {
      if (!/\.tsx$/.test(file)) return false;
      const source = readFileSync(file, 'utf8');
      return TENANT_SCOPED_ACTION_MODULES.some((module): boolean =>
        source.includes("'@/features/" + module + "'"),
      );
    });
    expect(consumers.length).toBeGreaterThan(8);
    const missing = consumers.filter((file): boolean => {
      const source = readFileSync(file, 'utf8');
      return !/TenantIdField|useTenantId/.test(source);
    });
    expect(missing.map((file): string => path.relative(root, file))).toEqual([]);
  });

  it('only the switch action and the invitation landing write the active_tenant cookie', (): void => {
    const writers = features
      .filter((file): boolean => /writeActiveTenantCookie/.test(readFileSync(file, 'utf8')))
      .map((file): string => path.relative(root, file).replace(/\\/g, '/'))
      .sort();
    expect(writers).toEqual([
      'features/iam/actions/switch-tenant.actions.ts',
      'features/iam/utils/active-tenant-cookie.ts',
      'features/users/actions/invite.actions.ts',
    ]);
  });
});

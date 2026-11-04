import { describe, expect, it } from 'vitest';
import { INVITATION_ACCOUNT_MODES, UserPermission } from '@canaldigital/packages/core';
import {
  INVITATION_ACCOUNT_MODE_OPTIONS,
  INVITATION_DEFAULT_ACCOUNT_MODE,
  INVITE_PAGE_ERROR_CODES,
  PERMISSION_GROUPS,
} from '@/features/users/constants';
import {
  dashboardNavigation,
  visibleDashboardNavigationKeys,
} from '@/features/dashboard/navigation/dashboard-navigation';
import es from '@/messages/es.json';
import en from '@/messages/en.json';

function leafPaths(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object') return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]): string[] =>
    leafPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('role editor permission groups', (): void => {
  it('only offers permissions that exist in Core', (): void => {
    const known = new Set<string>(Object.values(UserPermission));
    for (const group of PERMISSION_GROUPS)
      for (const permission of group.permissions) expect(known.has(permission)).toBe(true);
  });
  it('never offers owner-only user management', (): void => {
    const offered = PERMISSION_GROUPS.flatMap((group): readonly string[] => group.permissions);
    expect(offered).not.toContain(UserPermission.MANAGE_USERS);
  });
  it('has copy for every Core permission in both languages', (): void => {
    for (const messages of [es, en])
      for (const permission of Object.values(UserPermission)) {
        const item = (
          messages.Users.permissions.items as Record<string, { label: string; help: string }>
        )[permission];
        expect(item?.label).toBeTruthy();
        expect(item?.help).toBeTruthy();
      }
  });
});

describe('dashboard navigation permissions', (): void => {
  it('shows the owner every destination including user management', (): void => {
    expect(visibleDashboardNavigationKeys('OWNER', [])).toEqual(
      dashboardNavigation.map((item): string => item.key),
    );
  });
  it('shows a member only the destinations their role allows', (): void => {
    expect(visibleDashboardNavigationKeys('MEMBER', ['VIEW_ORDERS', 'MANAGE_CATALOG'])).toEqual([
      'overview',
      'orders',
      'products',
      'categories',
    ]);
  });
  it('hides user management from members even with the MANAGE_USERS permission', (): void => {
    expect(visibleDashboardNavigationKeys('MEMBER', ['MANAGE_USERS'])).toEqual(['overview']);
  });
  it('keeps integrations (Kivi) owner-only even for a member holding every delegable permission', (): void => {
    const everyPermission = PERMISSION_GROUPS.flatMap((group): string[] => [...group.permissions]);
    const keys = visibleDashboardNavigationKeys('MEMBER', everyPermission);
    expect(keys).not.toContain('integrations');
    expect(keys).not.toContain('users');
    expect(visibleDashboardNavigationKeys('OWNER', [])).toContain('integrations');
  });
  it('no longer offers a delegable integrations permission', (): void => {
    expect(Object.values(UserPermission)).not.toContain('MANAGE_INTEGRATIONS');
    expect(PERMISSION_GROUPS.map((group): string => group.key)).not.toContain('integrations');
  });
  it('shows a member without a role only the overview', (): void => {
    expect(visibleDashboardNavigationKeys('MEMBER', [])).toEqual(['overview']);
  });
});

describe('message catalogs', (): void => {
  it('keep Spanish and English keys in parity', (): void => {
    expect(leafPaths(es).sort()).toEqual(leafPaths(en).sort());
  });
});

describe('invitation account modes', (): void => {
  it('offers exactly the Core modes, with copy in both languages', (): void => {
    expect([...INVITATION_ACCOUNT_MODE_OPTIONS]).toEqual([...INVITATION_ACCOUNT_MODES]);
    expect(INVITATION_ACCOUNT_MODES).toContain(INVITATION_DEFAULT_ACCOUNT_MODE);
    for (const messages of [es, en]) {
      const modes = messages.Users.invitations.accountMode as unknown as Record<
        string,
        { label?: string; help?: string }
      >;
      const descriptions = messages.Users.invite.description as Record<string, string>;
      for (const mode of INVITATION_ACCOUNT_MODES) {
        expect(modes[mode]?.label).toBeTruthy();
        expect(modes[mode]?.help).toBeTruthy();
        expect(descriptions[mode]).toBeTruthy();
      }
    }
  });
  it('has a message for every error code the invitation page may show', (): void => {
    for (const messages of [es, en]) {
      const errors = messages.Users.invite.errors as Record<string, string>;
      for (const code of INVITE_PAGE_ERROR_CODES) expect(errors[code], code).toBeTruthy();
    }
  });
  it('warns that generated emails cannot recover passwords in both languages', (): void => {
    expect(en.Users.invitations.accountMode.GENERATED_EMAIL.help).toMatch(/cannot be recovered/i);
    expect(es.Users.invitations.accountMode.GENERATED_EMAIL.help).toMatch(/no se puede recuperar/i);
  });
});

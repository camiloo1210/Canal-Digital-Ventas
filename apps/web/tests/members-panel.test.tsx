import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import type { MemberReadModel } from '@canaldigital/packages/core';
import es from '@/messages/es.json';
import en from '@/messages/en.json';
import { MembersPanel } from '@/features/users/components/members-panel';
import { memberActionsFor } from '@/features/users/member-actions';

vi.mock('@/features/users/actions/members.actions', (): object => ({
  assignMemberRoleAction: vi.fn(),
  unlinkMemberAction: vi.fn(),
  setMemberActiveAction: vi.fn(),
  resetMemberPasswordAction: vi.fn(),
  renameMemberAction: vi.fn(),
}));

function member(overrides: Partial<MemberReadModel>): MemberReadModel {
  return {
    userId: crypto.randomUUID(),
    firstName: 'Ana',
    lastName: 'Perez',
    email: 'ana@shop.staff.invalid',
    baseRole: 'MEMBER',
    roleId: null,
    roleName: null,
    status: 'active',
    accountKind: 'MANAGED',
    accessStatus: 'ACTIVE',
    ...overrides,
  };
}

const owner = member({
  email: 'owner@shop.test',
  firstName: 'Olga',
  baseRole: 'OWNER',
  accountKind: 'PERSONAL',
});
const managed = member({ email: 'ana@shop.staff.invalid' });
const suspended = member({
  email: 'sus@shop.staff.invalid',
  status: 'suspended',
  accessStatus: 'SUSPENDED',
});
const personal = member({ email: 'real@gmail.com', accountKind: 'PERSONAL' });

function render(
  members: MemberReadModel[],
  adminAuthAvailable: boolean,
  locale: 'es' | 'en' = 'es',
): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'es' ? es : en} timeZone="UTC">
      <MembersPanel members={members} roles={[]} adminAuthAvailable={adminAuthAvailable} />
    </NextIntlClientProvider>,
  );
}

describe('memberActionsFor', (): void => {
  it('gives the owner row no actions', (): void => {
    expect(memberActionsFor(owner)).toEqual([]);
  });
  it('lets managed accounts be renamed, reset, deactivated and unlinked', (): void => {
    expect(memberActionsFor(managed)).toEqual(['rename', 'resetPassword', 'deactivate', 'unlink']);
  });
  it('offers reactivation instead of deactivation for suspended managed accounts', (): void => {
    expect(memberActionsFor(suspended)).toEqual([
      'rename',
      'resetPassword',
      'reactivate',
      'unlink',
    ]);
  });
  it('limits personal accounts to unlinking', (): void => {
    expect(memberActionsFor(personal)).toEqual(['unlink']);
  });
});

describe('MembersPanel', (): void => {
  const html = render([owner, managed, suspended, personal], true);

  it('labels business and personal accounts and the suspended state', (): void => {
    expect(html).toContain(es.Users.members.accountKind.managed);
    expect(html).toContain(es.Users.members.accountKind.personal);
    expect(html).toContain(es.Users.members.status.suspended);
  });

  it('renders one accessible 44px actions trigger per non owner row and none for the owner', (): void => {
    const triggers = html.match(/aria-label="Acciones de [^"]+"/g) ?? [];
    expect(triggers).toHaveLength(3);
    expect(html).not.toContain('Acciones de Olga');
    expect(html).not.toContain('Acciones de owner@shop.test');
    expect(html).toContain('size-11');
  });

  it('shows the missing service key notice only when managed accounts exist and the key is absent', (): void => {
    expect(html).not.toContain(es.Users.members.adminUnavailableNotice);
    expect(render([owner, managed], false)).toContain(es.Users.members.adminUnavailableNotice);
    expect(render([owner, personal], false)).not.toContain(es.Users.members.adminUnavailableNotice);
  });

  it('renders in English too', (): void => {
    const english = render([owner, managed], true, 'en');
    expect(english).toContain(en.Users.members.accountKind.managed);
  });
});

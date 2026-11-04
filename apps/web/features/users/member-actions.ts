import type { MemberReadModel } from '@canaldigital/packages/core';

export type MemberActionKey = 'rename' | 'resetPassword' | 'deactivate' | 'reactivate' | 'unlink';

/**
 * Which row actions to offer. Presentation only: Core re-checks ownership, tenant scope and
 * account kind on every call, so a stale or forged request is still rejected.
 */
export function memberActionsFor(member: MemberReadModel): MemberActionKey[] {
  if (member.baseRole === 'OWNER') return [];
  if (member.accountKind === 'PERSONAL') return ['unlink'];
  return [
    'rename',
    'resetPassword',
    member.accessStatus === 'SUSPENDED' ? 'reactivate' : 'deactivate',
    'unlink',
  ];
}

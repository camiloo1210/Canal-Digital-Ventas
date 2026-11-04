'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import {
  getAssignMemberRoleUseCase,
  getRenameManagedAccountUseCase,
  getResetManagedAccountPasswordUseCase,
  getSetMemberActiveUseCase,
  getUnlinkMemberUseCase,
} from '@/features/users/di/users.di';
import {
  assignRoleSchema,
  memberTargetSchema,
  renameMemberSchema,
  resetMemberPasswordSchema,
  setMemberActiveSchema,
} from '@/features/users/schemas/users.schema';
import { resolveUsersActor, usersErrorKey } from '@/features/users/actions/users-actor';
import type { UsersActor } from '@/features/users/actions/users-actor';
import type { MemberActionState, UsersActionState } from '@/features/users/types';

export async function assignMemberRoleAction(
  previous: UsersActionState,
  data: FormData,
): Promise<UsersActionState> {
  const t = await getTranslations('Users');
  const revision = previous.revision + 1;
  const fail = (key: string): UsersActionState => ({
    success: false,
    message: t(`errors.${key}`),
    revision,
  });
  try {
    const actor = await resolveUsersActor(data);
    if (actor === 'CONTEXT_CHANGED') return fail('contextChanged');
    if (!actor) return fail('unauthorized');
    const parsed = assignRoleSchema.safeParse({
      memberUserId: data.get('memberUserId'),
      roleId: data.get('roleId') ?? '',
    });
    if (!parsed.success) return fail('invalidInput');
    await getAssignMemberRoleUseCase().execute({
      ...actor,
      memberUserId: parsed.data.memberUserId,
      roleId: parsed.data.roleId === '' ? null : parsed.data.roleId,
    });
    revalidatePath('/dashboard/users');
    return { success: true, message: t('members.roleUpdated'), revision };
  } catch (error: unknown) {
    const key = usersErrorKey(error);
    if (key === 'unexpected') console.error('[Users] assignMemberRole failed', error);
    return fail(key);
  }
}

type Translate = Awaited<ReturnType<typeof getTranslations>>;

/** Either a success message (with an optional partial-outcome warning) or an `errors.*` key. */
type MemberOutcome = { message: string; warning?: string } | { errorKey: string };

/** Shared controller shell: session actor, typed error mapping, cache revalidation. */
async function runMemberAction(
  previous: MemberActionState,
  data: FormData,
  logLabel: string,
  handler: (actor: UsersActor, t: Translate) => Promise<MemberOutcome>,
): Promise<MemberActionState> {
  const t = await getTranslations('Users');
  const revision = previous.revision + 1;
  const fail = (key: string): MemberActionState => ({
    success: false,
    message: t(`errors.${key}`),
    revision,
  });
  try {
    const actor = await resolveUsersActor(data);
    if (actor === 'CONTEXT_CHANGED') return fail('contextChanged');
    if (!actor) return fail('unauthorized');
    const outcome = await handler(actor, t);
    if ('errorKey' in outcome) return fail(outcome.errorKey);
    revalidatePath('/dashboard/users');
    return { success: true, message: outcome.message, warning: outcome.warning, revision };
  } catch (error: unknown) {
    const key = usersErrorKey(error);
    // Only the error name is logged: nothing from the submitted payload (it may hold a password).
    if (key === 'unexpected') {
      console.error(`[Users] ${logLabel} failed`, error instanceof Error ? error.name : 'unknown');
    }
    return fail(key);
  }
}

export async function unlinkMemberAction(
  previous: MemberActionState,
  data: FormData,
): Promise<MemberActionState> {
  return runMemberAction(
    previous,
    data,
    'unlinkMember',
    async (actor: UsersActor, t: Translate): Promise<MemberOutcome> => {
      const parsed = memberTargetSchema.safeParse({ memberUserId: data.get('memberUserId') });
      if (!parsed.success) return { errorKey: 'invalidInput' };
      await getUnlinkMemberUseCase().execute({
        ...actor,
        memberUserId: parsed.data.memberUserId,
      });
      return { message: t('members.unlinked') };
    },
  );
}

export async function setMemberActiveAction(
  previous: MemberActionState,
  data: FormData,
): Promise<MemberActionState> {
  return runMemberAction(
    previous,
    data,
    'setMemberActive',
    async (actor: UsersActor, t: Translate): Promise<MemberOutcome> => {
      const parsed = setMemberActiveSchema.safeParse({
        memberUserId: data.get('memberUserId'),
        active: data.get('active'),
      });
      if (!parsed.success) return { errorKey: 'invalidInput' };
      await getSetMemberActiveUseCase().execute({
        ...actor,
        memberUserId: parsed.data.memberUserId,
        active: parsed.data.active,
      });
      return {
        message: parsed.data.active ? t('members.activated') : t('members.deactivated'),
      };
    },
  );
}

export async function resetMemberPasswordAction(
  previous: MemberActionState,
  data: FormData,
): Promise<MemberActionState> {
  return runMemberAction(
    previous,
    data,
    'resetMemberPassword',
    async (actor: UsersActor, t: Translate): Promise<MemberOutcome> => {
      const parsed = resetMemberPasswordSchema.safeParse({
        memberUserId: data.get('memberUserId'),
        newPassword: data.get('newPassword'),
      });
      if (!parsed.success) {
        const passwordIssue = parsed.error.issues.some(
          (issue): boolean => issue.path[0] === 'newPassword',
        );
        return { errorKey: passwordIssue ? 'invalidPassword' : 'invalidInput' };
      }
      const result = await getResetManagedAccountPasswordUseCase().execute({
        ...actor,
        memberUserId: parsed.data.memberUserId,
        newPassword: parsed.data.newPassword,
      });
      return {
        message: t('members.passwordReset'),
        warning: result.sessionsRevoked ? undefined : t('members.sessionsNotRevoked'),
      };
    },
  );
}

export async function renameMemberAction(
  previous: MemberActionState,
  data: FormData,
): Promise<MemberActionState> {
  return runMemberAction(
    previous,
    data,
    'renameMember',
    async (actor: UsersActor, t: Translate): Promise<MemberOutcome> => {
      const parsed = renameMemberSchema.safeParse({
        memberUserId: data.get('memberUserId'),
        firstName: data.get('firstName'),
        lastName: data.get('lastName'),
      });
      if (!parsed.success) return { errorKey: 'invalidInput' };
      await getRenameManagedAccountUseCase().execute({
        ...actor,
        memberUserId: parsed.data.memberUserId,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
      });
      return { message: t('members.renamed') };
    },
  );
}

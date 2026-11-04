'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import {
  getCreateTenantRoleUseCase,
  getDeleteTenantRoleUseCase,
  getUpdateTenantRoleUseCase,
} from '@/features/users/di/users.di';
import { deleteRoleSchema, roleFormSchema } from '@/features/users/schemas/users.schema';
import { resolveUsersActor, usersErrorKey } from '@/features/users/actions/users-actor';
import type { RoleActionState, UsersActionState } from '@/features/users/types';

const PATH = '/dashboard/users';

function readRoleForm(data: FormData): { roleId: string; name: string; permissions: string[] } {
  const roleId = data.get('roleId');
  const name = data.get('name');
  return {
    roleId: typeof roleId === 'string' ? roleId : '',
    name: typeof name === 'string' ? name : '',
    permissions: data.getAll('permissions').filter((v): v is string => typeof v === 'string'),
  };
}

export async function saveTenantRoleAction(
  previous: RoleActionState,
  data: FormData,
): Promise<RoleActionState> {
  const t = await getTranslations('Users');
  const raw = readRoleForm(data);
  const values = { name: raw.name, permissions: raw.permissions };
  const revision = previous.revision + 1;
  const fail = (key: string, fieldErrors?: RoleActionState['fieldErrors']): RoleActionState => ({
    success: false,
    message: t(`errors.${key}`),
    values,
    revision,
    ...(fieldErrors ? { fieldErrors } : {}),
  });
  try {
    const actor = await resolveUsersActor(data);
    if (actor === 'CONTEXT_CHANGED') return fail('contextChanged');
    if (!actor) return fail('unauthorized');
    const parsed = roleFormSchema.safeParse({
      roleId: raw.roleId === '' ? undefined : raw.roleId,
      name: raw.name,
      permissions: raw.permissions,
    });
    if (!parsed.success) {
      const fieldErrors: NonNullable<RoleActionState['fieldErrors']> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === 'name') fieldErrors.name = t('roles.validation.nameLength');
        if (field === 'permissions')
          fieldErrors.permissions = t('roles.validation.permissionsRequired');
      }
      return fail('invalidInput', fieldErrors);
    }
    const { roleId, name, permissions } = parsed.data;
    if (roleId) {
      await getUpdateTenantRoleUseCase().execute({ ...actor, roleId, name, permissions });
    } else {
      await getCreateTenantRoleUseCase().execute({ ...actor, name, permissions });
    }
    revalidatePath(PATH);
    return { success: true, message: t(roleId ? 'roles.updated' : 'roles.created'), revision };
  } catch (error: unknown) {
    const key = usersErrorKey(error);
    if (key === 'unexpected') console.error('[Users] saveTenantRole failed', error);
    return fail(key, key === 'roleNameTaken' ? { name: t('errors.roleNameTaken') } : undefined);
  }
}

export async function deleteTenantRoleAction(
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
    const parsed = deleteRoleSchema.safeParse({ roleId: data.get('roleId') });
    if (!parsed.success) return fail('invalidInput');
    await getDeleteTenantRoleUseCase().execute({ ...actor, roleId: parsed.data.roleId });
    revalidatePath(PATH);
    return { success: true, message: t('roles.deleted'), revision };
  } catch (error: unknown) {
    const key = usersErrorKey(error);
    if (key === 'unexpected') console.error('[Users] deleteTenantRole failed', error);
    return fail(key);
  }
}

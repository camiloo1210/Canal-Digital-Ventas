'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { saveTenantRoleAction } from '@/features/users/actions/roles.actions';
import { PERMISSION_GROUPS } from '@/features/users/constants';
import type { RoleActionState } from '@/features/users/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TenantIdField } from '@/features/dashboard/components/tenant-scope';

export interface RoleFormInitial {
  roleId: string | null;
  name: string;
  permissions: string[];
}

export function RoleForm({
  initial,
  onDone,
}: {
  initial: RoleFormInitial;
  onDone: () => void;
}): React.JSX.Element {
  const t = useTranslations('Users');
  const [selected, setSelected] = useState<string[]>(initial.permissions);
  const [state, action, pending] = useActionState(
    async (previous: RoleActionState, data: FormData): Promise<RoleActionState> => {
      const result = await saveTenantRoleAction(previous, data);
      if (result.success) onDone();
      return result;
    },
    { success: false, message: null, revision: 0 } satisfies RoleActionState,
  );
  const errors = state.fieldErrors;
  const name = state.values?.name ?? initial.name;

  const toggle = (permission: string, checked: boolean): void =>
    setSelected((current): string[] =>
      checked
        ? current.includes(permission)
          ? current
          : [...current, permission]
        : current.filter((value): boolean => value !== permission),
    );

  return (
    <form action={action} aria-busy={pending} className="flex min-h-0 flex-1 flex-col gap-5">
      <TenantIdField />
      {initial.roleId && <input type="hidden" name="roleId" value={initial.roleId} />}
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4">
        {state.message && !state.success && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive"
          >
            {state.message}
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="role-name">{t('roles.name')}</Label>
          <Input
            id="role-name"
            name="name"
            defaultValue={name}
            maxLength={40}
            required
            autoComplete="off"
            className="min-h-11"
            placeholder={t('roles.namePlaceholder')}
            aria-invalid={Boolean(errors?.name)}
            aria-describedby={errors?.name ? 'role-name-error' : undefined}
          />
          {errors?.name && (
            <p id="role-name-error" role="alert" className="text-sm text-destructive">
              {errors.name}
            </p>
          )}
        </div>

        <fieldset
          className="space-y-4"
          aria-describedby={errors?.permissions ? 'role-permissions-error' : undefined}
        >
          <legend className="text-sm font-medium">{t('roles.permissions')}</legend>
          {errors?.permissions && (
            <p id="role-permissions-error" role="alert" className="text-sm text-destructive">
              {errors.permissions}
            </p>
          )}
          {PERMISSION_GROUPS.map((group): React.JSX.Element => {
            const checkedCount = group.permissions.filter((permission): boolean =>
              selected.includes(permission),
            ).length;
            const allChecked = checkedCount === group.permissions.length;
            return (
              <div key={group.key} className="space-y-1 rounded-lg border p-3">
                <div className="flex min-h-11 items-center gap-3">
                  <Checkbox
                    id={`group-${group.key}`}
                    checked={allChecked}
                    indeterminate={checkedCount > 0 && !allChecked}
                    onCheckedChange={(checked): void =>
                      setSelected((current): string[] => [
                        ...current.filter((value): boolean => !group.permissions.includes(value)),
                        ...(checked ? group.permissions : []),
                      ])
                    }
                  />
                  <Label
                    htmlFor={`group-${group.key}`}
                    className="min-h-11 flex-1 cursor-pointer font-semibold"
                  >
                    {t(`permissions.groups.${group.key}`)}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {t('roles.selectAll')}
                    </span>
                  </Label>
                </div>
                {group.permissions.map((permission): React.JSX.Element => (
                  <div key={permission} className="flex min-h-11 items-center gap-3 pl-6">
                    <Checkbox
                      id={`perm-${permission}`}
                      name="permissions"
                      value={permission}
                      checked={selected.includes(permission)}
                      onCheckedChange={(checked): void => toggle(permission, checked)}
                    />
                    <Label
                      htmlFor={`perm-${permission}`}
                      className="min-h-11 flex-1 cursor-pointer"
                    >
                      <span className="block">{t(`permissions.items.${permission}.label`)}</span>
                      <span className="block text-xs font-normal text-muted-foreground">
                        {t(`permissions.items.${permission}.help`)}
                      </span>
                    </Label>
                  </div>
                ))}
              </div>
            );
          })}
        </fieldset>
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t p-4">
        <Button type="button" variant="outline" className="min-h-11" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" className="min-h-11" disabled={pending}>
          {pending ? t('common.saving') : t('common.save')}
        </Button>
      </div>
    </form>
  );
}

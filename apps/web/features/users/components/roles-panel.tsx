'use client';

import { useActionState, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import type { TenantRoleReadModel } from '@canaldigital/packages/core';
import { deleteTenantRoleAction } from '@/features/users/actions/roles.actions';
import { RoleForm, type RoleFormInitial } from '@/features/users/components/role-form';
import { INITIAL_USERS_STATE, type UsersActionState } from '@/features/users/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TenantIdField } from '@/features/dashboard/components/tenant-scope';

function DeleteRoleDialog({
  role,
  onClose,
}: {
  role: TenantRoleReadModel;
  onClose: () => void;
}): React.JSX.Element {
  const t = useTranslations('Users');
  const [state, action, pending] = useActionState(
    async (previous: UsersActionState, data: FormData): Promise<UsersActionState> => {
      const result = await deleteTenantRoleAction(previous, data);
      if (result.success) onClose();
      return result;
    },
    INITIAL_USERS_STATE,
  );
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t('roles.deleteTitle', { name: role.name })}</DialogTitle>
        <DialogDescription>
          {role.memberCount > 0
            ? t('roles.deleteBlocked', { count: role.memberCount })
            : t('roles.deleteBody')}
        </DialogDescription>
      </DialogHeader>
      {state.message && !state.success && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      <form action={action}>
        <TenantIdField />
        <input type="hidden" name="roleId" value={role.id} />
        <DialogFooter>
          <Button type="button" variant="outline" className="min-h-11" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="destructive"
            className="min-h-11"
            disabled={pending || role.memberCount > 0}
          >
            {pending ? t('common.deleting') : t('roles.delete')}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

export function RolesPanel({ roles }: { roles: TenantRoleReadModel[] }): React.JSX.Element {
  const t = useTranslations('Users');
  const format = useFormatter();
  const [editing, setEditing] = useState<RoleFormInitial | null>(null);
  const [deleting, setDeleting] = useState<TenantRoleReadModel | null>(null);

  return (
    <Card className="shadow-none">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck aria-hidden="true" className="size-5" />
            <h2>{t('roles.title')}</h2>
          </CardTitle>
          <Button
            className="min-h-11"
            onClick={(): void => setEditing({ roleId: null, name: '', permissions: [] })}
          >
            <Plus aria-hidden="true" />
            {t('roles.new')}
          </Button>
        </div>
        <CardDescription>{t('roles.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {roles.length === 0 ? (
          <p role="status" className="rounded-lg border bg-muted/40 p-4 text-sm">
            {t('roles.empty')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('roles.name')}</TableHead>
                  <TableHead>{t('roles.permissions')}</TableHead>
                  <TableHead className="text-right">{t('roles.members')}</TableHead>
                  <TableHead>{t('roles.createdAt')}</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">{t('common.actions')}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role): React.JSX.Element => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell>
                      <div className="flex max-w-md flex-wrap gap-1">
                        {role.permissions.map((permission): React.JSX.Element => (
                          <Badge key={permission} variant="secondary">
                            {t(`permissions.items.${permission}.label`)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{role.memberCount}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {format.dateTime(new Date(role.createdAt), { dateStyle: 'medium' })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          className="size-11"
                          aria-label={t('roles.editLabel', { name: role.name })}
                          onClick={(): void =>
                            setEditing({
                              roleId: role.id,
                              name: role.name,
                              permissions: role.permissions,
                            })
                          }
                        >
                          <Pencil aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          className="size-11"
                          aria-label={t('roles.deleteLabel', { name: role.name })}
                          onClick={(): void => setDeleting(role)}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Sheet
        open={editing !== null}
        onOpenChange={(open): void => {
          if (!open) setEditing(null);
        }}
      >
        <SheetContent closeLabel={t('common.close')} className="data-[side=right]:sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editing?.roleId ? t('roles.edit') : t('roles.new')}</SheetTitle>
            <SheetDescription>{t('roles.formHelp')}</SheetDescription>
          </SheetHeader>
          {editing && (
            <RoleForm
              key={editing.roleId ?? 'new'}
              initial={editing}
              onDone={(): void => setEditing(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      <Dialog
        open={deleting !== null}
        onOpenChange={(open): void => {
          if (!open) setDeleting(null);
        }}
      >
        {deleting && (
          <DeleteRoleDialog
            key={deleting.id}
            role={deleting}
            onClose={(): void => setDeleting(null)}
          />
        )}
      </Dialog>
    </Card>
  );
}

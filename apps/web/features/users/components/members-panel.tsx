'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { UsersRound } from 'lucide-react';
import type { MemberReadModel, TenantRoleReadModel } from '@canaldigital/packages/core';
import { staffLoginIdentifier } from '@canaldigital/packages/core/staff-login';
import { assignMemberRoleAction } from '@/features/users/actions/members.actions';
import { MemberAccountActions } from '@/features/users/components/member-account-actions';
import { INITIAL_USERS_STATE } from '@/features/users/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TenantIdField } from '@/features/dashboard/components/tenant-scope';

const NO_ROLE = '';

function AssignRoleForm({
  member,
  roles,
}: {
  member: MemberReadModel;
  roles: TenantRoleReadModel[];
}): React.JSX.Element {
  const t = useTranslations('Users');
  const [state, action, pending] = useActionState(assignMemberRoleAction, INITIAL_USERS_STATE);
  const items = [
    { value: NO_ROLE, label: t('members.noRole') },
    ...roles.map((role): { value: string; label: string } => ({
      value: role.id,
      label: role.name,
    })),
  ];
  const label = t('members.roleFor', { name: member.email });
  return (
    <form action={action} aria-busy={pending} className="flex flex-wrap items-center gap-2">
      <TenantIdField />
      <input type="hidden" name="memberUserId" value={member.userId} />
      <Select name="roleId" items={items} defaultValue={member.roleId ?? NO_ROLE}>
        <SelectTrigger className="min-h-11 w-48" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item): React.JSX.Element => (
            <SelectItem key={item.value || 'none'} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit" variant="outline" className="min-h-11" disabled={pending}>
        {pending ? t('common.saving') : t('common.save')}
      </Button>
      {state.message && (
        <span
          role={state.success ? 'status' : 'alert'}
          className={state.success ? 'text-xs text-muted-foreground' : 'text-xs text-destructive'}
        >
          {state.message}
        </span>
      )}
    </form>
  );
}

export function MembersPanel({
  members,
  roles,
  adminAuthAvailable,
}: {
  members: MemberReadModel[];
  roles: TenantRoleReadModel[];
  /** False when SUPABASE_SERVICE_ROLE_KEY is not configured on the server. */
  adminAuthAvailable: boolean;
}): React.JSX.Element {
  const t = useTranslations('Users');
  const hasManagedAccounts = members.some(
    (member): boolean => member.accountKind === 'MANAGED' && member.baseRole !== 'OWNER',
  );
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UsersRound aria-hidden="true" className="size-5" />
          <h2>{t('members.title')}</h2>
        </CardTitle>
        <CardDescription>{t('members.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!adminAuthAvailable && hasManagedAccounts && (
          <p
            role="note"
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
          >
            {t('members.adminUnavailableNotice')}
          </p>
        )}
        {members.length === 0 ? (
          <p role="status" className="rounded-lg border bg-muted/40 p-4 text-sm">
            {t('members.empty')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('members.name')}</TableHead>
                  <TableHead>{t('members.email')}</TableHead>
                  <TableHead>{t('members.accountHeader')}</TableHead>
                  <TableHead>{t('members.statusHeader')}</TableHead>
                  <TableHead>{t('members.role')}</TableHead>
                  <TableHead className="w-14">
                    <span className="sr-only">{t('members.actionsHeader')}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member): React.JSX.Element => {
                  const fullName = `${member.firstName} ${member.lastName}`.trim();
                  return (
                    <TableRow key={member.userId}>
                      <TableCell className="font-medium">{fullName || '—'}</TableCell>
                      <TableCell>
                        {member.accountKind === 'MANAGED'
                          ? staffLoginIdentifier(member.email)
                          : member.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant={member.accountKind === 'MANAGED' ? 'secondary' : 'outline'}>
                          {t(
                            member.accountKind === 'MANAGED'
                              ? 'members.accountKind.managed'
                              : 'members.accountKind.personal',
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={member.accessStatus === 'ACTIVE' ? 'default' : 'destructive'}
                        >
                          {t(`members.status.${member.status}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {member.baseRole === 'OWNER' ? (
                          <Badge variant="outline">{t('members.owner')}</Badge>
                        ) : member.accessStatus === 'ACTIVE' ? (
                          <AssignRoleForm member={member} roles={roles} />
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {member.roleName ?? t('members.noRole')}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <MemberAccountActions
                          member={member}
                          adminAuthAvailable={adminAuthAvailable}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

'use client';

import { useActionState, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Check, Copy, Link2, Ban } from 'lucide-react';
import type { InvitationReadModel, TenantRoleReadModel } from '@canaldigital/packages/core';
import {
  createInvitationAction,
  revokeInvitationAction,
} from '@/features/users/actions/invitations.actions';
import {
  INVITATION_ACCOUNT_MODE_OPTIONS,
  INVITATION_DEFAULT_ACCOUNT_MODE,
  INVITATION_DEFAULT_EXPIRY_DAYS,
  INVITATION_DEFAULT_MAX_USES,
  INVITATION_EXPIRY_OPTIONS,
  INVITATION_MAX_USES,
} from '@/features/users/constants';
import { INITIAL_USERS_STATE, type InvitationActionState } from '@/features/users/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

function RevokeButton({ invitationId }: { invitationId: string }): React.JSX.Element {
  const t = useTranslations('Users');
  const [state, action, pending] = useActionState(revokeInvitationAction, INITIAL_USERS_STATE);
  return (
    <form action={action} className="flex items-center justify-end gap-2">
      <TenantIdField />
      <input type="hidden" name="invitationId" value={invitationId} />
      {state.message && !state.success && (
        <span role="alert" className="text-xs text-destructive">
          {state.message}
        </span>
      )}
      <Button type="submit" variant="outline" className="min-h-11" disabled={pending}>
        <Ban aria-hidden="true" />
        {pending ? t('common.working') : t('invitations.revoke')}
      </Button>
    </form>
  );
}

function AccountModeFieldset({
  defaultValue,
  error,
  adminAuthAvailable,
}: {
  defaultValue: string;
  error?: string;
  adminAuthAvailable: boolean;
}): React.JSX.Element {
  const t = useTranslations('Users.invitations.accountMode');
  return (
    <fieldset
      className="space-y-2"
      aria-describedby={error ? 'invite-account-mode-error' : undefined}
    >
      <legend className="text-sm font-medium">{t('legend')}</legend>
      <p className="text-sm text-muted-foreground">{t('intro')}</p>
      {!adminAuthAvailable && (
        <p role="alert" className="text-sm text-destructive">
          {t('adminUnavailableWarning')}
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-3">
        {INVITATION_ACCOUNT_MODE_OPTIONS.map((mode): React.JSX.Element => {
          const id = `invite-account-mode-${mode}`;
          const unavailable = mode === 'GENERATED_EMAIL' && !adminAuthAvailable;
          return (
            <div key={mode} className="relative">
              <input
                id={id}
                type="radio"
                name="accountMode"
                value={mode}
                defaultChecked={mode === defaultValue && !unavailable}
                disabled={unavailable}
                aria-describedby={`${id}-help`}
                className="peer sr-only"
              />
              <label
                htmlFor={id}
                className="flex min-h-11 h-full cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-checked:border-primary peer-checked:bg-primary/5 peer-focus-visible:ring-2 peer-focus-visible:ring-ring"
              >
                <span className="font-medium">{t(`${mode}.label`)}</span>
                <span id={`${id}-help`} className="text-muted-foreground">
                  {t(`${mode}.help`)}
                </span>
              </label>
            </div>
          );
        })}
      </div>
      {error && (
        <p id="invite-account-mode-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function CopyLink({ link }: { link: string }): React.JSX.Element {
  const t = useTranslations('Users');
  const [copied, setCopied] = useState(false);
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Input
        readOnly
        value={link}
        aria-label={t('invitations.linkLabel')}
        className="min-h-11 font-mono text-xs"
        onFocus={(event): void => event.currentTarget.select()}
      />
      <Button type="button" className="min-h-11" onClick={copy}>
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {copied ? t('invitations.copied') : t('invitations.copy')}
      </Button>
    </div>
  );
}

export function InvitationsPanel({
  roles,
  invitations,
  adminAuthAvailable,
}: {
  roles: TenantRoleReadModel[];
  invitations: InvitationReadModel[];
  /** False when SUPABASE_SERVICE_ROLE_KEY is missing: generated-email accounts can not be created. */
  adminAuthAvailable: boolean;
}): React.JSX.Element {
  const t = useTranslations('Users');
  const format = useFormatter();
  const [state, action, pending] = useActionState(
    async (previous: InvitationActionState, data: FormData): Promise<InvitationActionState> =>
      createInvitationAction(previous, data),
    { success: false, message: null, revision: 0 } satisfies InvitationActionState,
  );
  const errors = state.fieldErrors;
  const roleItems = roles.map((role): { value: string; label: string } => ({
    value: role.id,
    label: role.name,
  }));
  const expiryItems = INVITATION_EXPIRY_OPTIONS.map((days): { value: string; label: string } => ({
    value: String(days),
    label: t('invitations.expiryDays', { count: days }),
  }));

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 aria-hidden="true" className="size-5" />
          <h2>{t('invitations.title')}</h2>
        </CardTitle>
        <CardDescription>{t('invitations.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {roles.length === 0 ? (
          <p role="status" className="rounded-lg border bg-muted/40 p-4 text-sm">
            {t('invitations.noRoles')}
          </p>
        ) : (
          <form action={action} aria-busy={pending} className="space-y-4">
            <TenantIdField />
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="invite-role">{t('invitations.role')}</Label>
                <Select
                  name="roleId"
                  items={roleItems}
                  defaultValue={state.values?.roleId || roles[0]?.id}
                >
                  <SelectTrigger
                    id="invite-role"
                    className="min-h-11 w-full"
                    aria-invalid={Boolean(errors?.roleId)}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role): React.JSX.Element => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors?.roleId && (
                  <p role="alert" className="text-sm text-destructive">
                    {errors.roleId}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-expiry">{t('invitations.expiry')}</Label>
                <Select
                  name="expiresInDays"
                  items={expiryItems}
                  defaultValue={
                    state.values?.expiresInDays || String(INVITATION_DEFAULT_EXPIRY_DAYS)
                  }
                >
                  <SelectTrigger
                    id="invite-expiry"
                    className="min-h-11 w-full"
                    aria-invalid={Boolean(errors?.expiresInDays)}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {expiryItems.map((item): React.JSX.Element => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors?.expiresInDays && (
                  <p role="alert" className="text-sm text-destructive">
                    {errors.expiresInDays}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-max-uses">{t('invitations.maxUses')}</Label>
                <Input
                  id="invite-max-uses"
                  name="maxUses"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={INVITATION_MAX_USES}
                  step={1}
                  required
                  defaultValue={state.values?.maxUses || String(INVITATION_DEFAULT_MAX_USES)}
                  className="min-h-11"
                  aria-invalid={Boolean(errors?.maxUses)}
                />
                {errors?.maxUses && (
                  <p role="alert" className="text-sm text-destructive">
                    {errors.maxUses}
                  </p>
                )}
              </div>
            </div>
            <AccountModeFieldset
              key={state.revision}
              defaultValue={
                state.values?.accountMode ||
                (adminAuthAvailable ? INVITATION_DEFAULT_ACCOUNT_MODE : 'REAL_EMAIL')
              }
              error={errors?.accountMode}
              adminAuthAvailable={adminAuthAvailable}
            />
            <Button type="submit" className="min-h-11" disabled={pending}>
              {pending ? t('invitations.creating') : t('invitations.create')}
            </Button>
            {state.message && !state.success && (
              <p role="alert" className="text-sm text-destructive">
                {state.message}
              </p>
            )}
          </form>
        )}

        {state.success && state.link && (
          <div
            role="status"
            className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-4"
          >
            <p className="font-medium">{t('invitations.linkTitle')}</p>
            <p className="text-sm text-muted-foreground">
              {t('invitations.linkWarning')}
              {state.expiresAt &&
                ' ' +
                  t('invitations.linkExpires', {
                    date: format.dateTime(new Date(state.expiresAt), {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }),
                  })}
            </p>
            <CopyLink link={state.link} />
          </div>
        )}

        {invitations.length === 0 ? (
          <p role="status" className="text-sm text-muted-foreground">
            {t('invitations.empty')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('invitations.role')}</TableHead>
                  <TableHead>{t('invitations.accountMode.header')}</TableHead>
                  <TableHead>{t('invitations.statusHeader')}</TableHead>
                  <TableHead>{t('invitations.expires')}</TableHead>
                  <TableHead className="text-right">{t('invitations.uses')}</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">{t('common.actions')}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation): React.JSX.Element => (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium">{invitation.roleName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {t(`invitations.accountMode.${invitation.accountMode}.label`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={invitation.status === 'ACTIVE' ? 'default' : 'secondary'}>
                        {t(`invitations.status.${invitation.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {format.dateTime(new Date(invitation.expiresAt), {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {invitation.useCount} / {invitation.maxUses}
                    </TableCell>
                    <TableCell className="text-right">
                      {invitation.status === 'ACTIVE' && (
                        <RevokeButton invitationId={invitation.id} />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

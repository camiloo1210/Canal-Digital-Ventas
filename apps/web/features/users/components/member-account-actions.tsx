'use client';

import { useActionState, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { MoreHorizontal } from 'lucide-react';
import type { MemberReadModel } from '@canaldigital/packages/core';
import {
  renameMemberAction,
  resetMemberPasswordAction,
  setMemberActiveAction,
  unlinkMemberAction,
} from '@/features/users/actions/members.actions';
import { memberActionsFor, type MemberActionKey } from '@/features/users/member-actions';
import { INITIAL_USERS_STATE, type MemberActionState } from '@/features/users/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { PERSON_NAME_INPUT } from '@/lib/input-attributes';
import { Label } from '@/components/ui/label';
import { TenantIdField } from '@/features/dashboard/components/tenant-scope';

type MemberAction = (previous: MemberActionState, data: FormData) => Promise<MemberActionState>;

const MENU_LABELS: Record<MemberActionKey, string> = {
  rename: 'actionRename',
  resetPassword: 'actionResetPassword',
  deactivate: 'actionDeactivate',
  reactivate: 'actionReactivate',
  unlink: 'actionUnlink',
};

interface DialogShellProps {
  action: MemberAction;
  memberUserId: string;
  title: string;
  description: string;
  submitLabel: string;
  destructive?: boolean;
  submitDisabled?: boolean;
  onClose: () => void;
  finalFocus: React.RefObject<HTMLButtonElement | null>;
  children?: React.ReactNode;
  hidden?: Record<string, string>;
}

/** Mounted only while open, so every opening starts with a fresh action state. */
function ActionDialog({
  action,
  memberUserId,
  title,
  description,
  submitLabel,
  destructive = false,
  submitDisabled = false,
  onClose,
  finalFocus,
  children,
  hidden = {},
}: DialogShellProps): React.JSX.Element {
  const t = useTranslations('Users');
  const [state, formAction, pending] = useActionState<MemberActionState, FormData>(
    action,
    INITIAL_USERS_STATE,
  );
  return (
    <Dialog
      open
      onOpenChange={(value): void => {
        if (!value && !pending) onClose();
      }}
    >
      <DialogContent showCloseButton={false} finalFocus={finalFocus} closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {state.success ? (
          <div className="space-y-3">
            <p role="status" className="text-sm">
              {state.message}
            </p>
            {state.warning && (
              <p
                role="alert"
                className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
              >
                {state.warning}
              </p>
            )}
            <DialogFooter>
              <Button type="button" className="min-h-11" onClick={onClose}>
                {t('members.done')}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form action={formAction} aria-busy={pending} className="space-y-4">
            <TenantIdField />
            <input type="hidden" name="memberUserId" value={memberUserId} />
            {Object.entries(hidden).map(([name, value]): React.JSX.Element => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            {children}
            {state.message && (
              <p role="alert" className="text-sm text-destructive">
                {state.message}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={pending}
                onClick={onClose}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                variant={destructive ? 'destructive' : 'default'}
                className="min-h-11"
                disabled={pending || submitDisabled}
              >
                {pending ? t('members.working') : submitLabel}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RenameFields({ member }: { member: MemberReadModel }): React.JSX.Element {
  const t = useTranslations('Users');
  // Controlled so a rejected submission never loses what was typed.
  const [firstName, setFirstName] = useState(member.firstName);
  const [lastName, setLastName] = useState(member.lastName);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor={`rename-first-${member.userId}`}>{t('members.firstName')}</Label>
        <Input
          id={`rename-first-${member.userId}`}
          name="firstName"
          className="min-h-11"
          value={firstName}
          maxLength={PERSON_NAME_INPUT.maxLength}
          pattern={PERSON_NAME_INPUT.pattern}
          required
          autoComplete="off"
          onChange={(event): void => setFirstName(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`rename-last-${member.userId}`}>{t('members.lastName')}</Label>
        <Input
          id={`rename-last-${member.userId}`}
          name="lastName"
          className="min-h-11"
          value={lastName}
          maxLength={PERSON_NAME_INPUT.maxLength}
          pattern={PERSON_NAME_INPUT.pattern}
          required
          autoComplete="off"
          onChange={(event): void => setLastName(event.target.value)}
        />
      </div>
    </div>
  );
}

function PasswordFields({
  member,
  adminAuthAvailable,
}: {
  member: MemberReadModel;
  adminAuthAvailable: boolean;
}): React.JSX.Element {
  const t = useTranslations('Users');
  const helpId = `password-help-${member.userId}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={`password-${member.userId}`}>{t('members.newPassword')}</Label>
      <Input
        id={`password-${member.userId}`}
        name="newPassword"
        type="password"
        autoComplete="new-password"
        className="min-h-11"
        minLength={8}
        maxLength={200}
        required
        disabled={!adminAuthAvailable}
        aria-describedby={helpId}
      />
      <p id={helpId} className="text-xs text-muted-foreground">
        {adminAuthAvailable ? t('members.newPasswordHelp') : t('members.adminUnavailableHere')}
      </p>
    </div>
  );
}

export function MemberAccountActions({
  member,
  adminAuthAvailable,
}: {
  member: MemberReadModel;
  adminAuthAvailable: boolean;
}): React.JSX.Element | null {
  const t = useTranslations('Users');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState<MemberActionKey | null>(null);
  const actions = memberActionsFor(member);
  if (actions.length === 0) return null;
  const name = `${member.firstName} ${member.lastName}`.trim() || member.email;
  const close = (): void => setOpen(null);
  const shared = { memberUserId: member.userId, onClose: close, finalFocus: triggerRef };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              ref={triggerRef}
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 shrink-0"
              aria-label={t('members.actionsFor', { name })}
            />
          }
        >
          <MoreHorizontal aria-hidden="true" className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          {actions.map((key, index): React.JSX.Element => (
            <div key={key}>
              {key === 'unlink' && index > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem
                className={key === 'unlink' ? 'min-h-11 text-destructive' : 'min-h-11'}
                onClick={(): void => setOpen(key)}
              >
                {t(`members.${MENU_LABELS[key]}`)}
              </DropdownMenuItem>
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {open === 'rename' && (
        <ActionDialog
          {...shared}
          action={renameMemberAction}
          title={t('members.renameTitle')}
          description={t('members.renameDescription', { name })}
          submitLabel={t('common.save')}
        >
          <RenameFields member={member} />
        </ActionDialog>
      )}
      {open === 'resetPassword' && (
        <ActionDialog
          {...shared}
          action={resetMemberPasswordAction}
          title={t('members.resetTitle')}
          description={t('members.resetDescription', { name })}
          submitLabel={t('members.confirm')}
          submitDisabled={!adminAuthAvailable}
        >
          <PasswordFields member={member} adminAuthAvailable={adminAuthAvailable} />
        </ActionDialog>
      )}
      {(open === 'deactivate' || open === 'reactivate') && (
        <ActionDialog
          {...shared}
          action={setMemberActiveAction}
          hidden={{ active: open === 'reactivate' ? 'true' : 'false' }}
          title={t(open === 'reactivate' ? 'members.reactivateTitle' : 'members.deactivateTitle')}
          description={t(
            open === 'reactivate'
              ? 'members.reactivateDescription'
              : 'members.deactivateDescription',
            { name },
          )}
          submitLabel={t('members.confirm')}
          destructive={open === 'deactivate'}
        />
      )}
      {open === 'unlink' && (
        <ActionDialog
          {...shared}
          action={unlinkMemberAction}
          title={t('members.unlinkTitle')}
          description={t(
            member.accountKind === 'MANAGED'
              ? 'members.unlinkManagedDescription'
              : 'members.unlinkPersonalDescription',
            { name },
          )}
          submitLabel={t('members.actionUnlink')}
          destructive
        />
      )}
    </>
  );
}

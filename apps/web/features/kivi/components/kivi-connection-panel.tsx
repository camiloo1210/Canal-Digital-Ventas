'use client';

import { useActionState, useState } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import type { KiviConnectionReadModel } from '@canaldigital/packages/core';
import {
  pairKiviAction,
  requestKiviSyncAction,
  unlinkKiviAction,
  type KiviConnectionActionState,
} from '@/features/kivi/actions/kivi-connection.actions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldError } from '@/components/ui/field';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const IDLE: KiviConnectionActionState = { success: false, message: null };

function Feedback({ state }: { state: KiviConnectionActionState }): React.JSX.Element | null {
  if (!state.message) return null;
  return state.success ? (
    <p
      role="status"
      className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success"
    >
      {state.message}
    </p>
  ) : (
    <p
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
    >
      {state.message}
    </p>
  );
}

function PairForm(): React.JSX.Element {
  const t = useTranslations('KiviConnection');
  const [state, action, pending] = useActionState(pairKiviAction, IDLE);
  const [dismissedRevision, setDismissedRevision] = useState(-1);
  const revision = state.revision ?? 0;
  const fieldError = dismissedRevision === revision ? undefined : state.fieldErrors?.code?.[0];
  // The inline error already carries the message for field-level failures; avoid saying it twice.
  const banner: KiviConnectionActionState = fieldError ? { ...state, message: null } : state;
  return (
    <form action={action} noValidate className="space-y-4" aria-busy={pending}>
      <Feedback state={banner} />
      <fieldset disabled={pending} className="min-w-0 space-y-4 disabled:opacity-70">
        <div className="space-y-2">
          <Label htmlFor="kivi-code">{t('code')}</Label>
          <Input
            id="kivi-code"
            name="code"
            type="text"
            required
            key={`code-${revision}`}
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="kvp_..."
            className="min-h-11 font-mono"
            aria-invalid={Boolean(fieldError)}
            aria-describedby={'kivi-code-help' + (fieldError ? ' kivi-code-error' : '')}
            onChange={(): void => setDismissedRevision(revision)}
          />
          <p id="kivi-code-help" className="text-sm text-muted-foreground">
            {t('codeHelp')}
          </p>
          {fieldError && <FieldError id="kivi-code-error">{fieldError}</FieldError>}
        </div>
        <Button type="submit" className="min-h-11" disabled={pending}>
          {pending ? t('connecting') : t('connect')}
        </Button>
      </fieldset>
    </form>
  );
}

function SyncNowForm(): React.JSX.Element {
  const t = useTranslations('KiviConnection');
  const [state, formAction, pending] = useActionState(requestKiviSyncAction, IDLE);
  return (
    <form action={formAction} className="space-y-2">
      <Button type="submit" className="min-h-11" disabled={pending}>
        {pending ? t('syncing') : t('syncNow')}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

function DisconnectDialog(): React.JSX.Element {
  const t = useTranslations('KiviConnection');
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(unlinkKiviAction, IDLE);
  return (
    <Dialog
      open={open}
      onOpenChange={(next: boolean): void => {
        if (!pending) setOpen(next);
      }}
    >
      <DialogTrigger render={<Button type="button" variant="outline" className="min-h-11" />}>
        {t('disconnect')}
      </DialogTrigger>
      <DialogContent>
        <form action={formAction} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t('disconnectTitle')}</DialogTitle>
            <DialogDescription>{t('disconnectConfirm')}</DialogDescription>
          </DialogHeader>
          <Feedback state={state} />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={pending}
              onClick={(): void => setOpen(false)}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" variant="destructive" className="min-h-11" disabled={pending}>
              {pending ? t('disconnecting') : t('disconnectAction')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NotConnected(): React.JSX.Element {
  const t = useTranslations('KiviConnection');
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>
          <h2>{t('notConnectedTitle')}</h2>
        </CardTitle>
        <CardDescription>{t('notConnectedHelp')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>{t('steps.one')}</li>
          <li>{t('steps.two')}</li>
          <li>{t('steps.three')}</li>
        </ol>
        <PairForm />
        <p className="text-sm text-muted-foreground">{t('ownerOnly')}</p>
      </CardContent>
    </Card>
  );
}

function Connected({ connection }: { connection: KiviConnectionReadModel }): React.JSX.Element {
  const t = useTranslations('KiviConnection');
  const format = useFormatter();
  const { status } = connection;
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>
          <h2>{t(`states.${status}.title`)}</h2>
        </CardTitle>
        <CardDescription>{t(`states.${status}.help`)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <dl className="grid gap-3 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
          <dt className="text-muted-foreground">{t('status')}</dt>
          <dd>
            <Badge
              variant={status === 'active' ? 'default' : 'secondary'}
              role="status"
              aria-live="polite"
            >
              {t(`states.${status}.badge`)}
            </Badge>
          </dd>
          <dt className="text-muted-foreground">{t('lastSync')}</dt>
          <dd>
            {connection.lastReconciledAt
              ? format.dateTime(new Date(connection.lastReconciledAt), {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })
              : t('never')}
          </dd>
        </dl>
        {connection.source === 'legacy' && (
          <p className="text-sm text-muted-foreground">{t('legacyNote')}</p>
        )}
        <div className="flex flex-wrap items-start gap-3">
          {status !== 'pending' && <SyncNowForm />}
          <DisconnectDialog />
        </div>
        {status !== 'pending' && (
          <p className="text-sm text-muted-foreground">{t('syncNowHelp')}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function KiviConnectionPanel({
  connection,
}: {
  connection: KiviConnectionReadModel | null;
}): React.JSX.Element {
  return connection ? <Connected connection={connection} /> : <NotConnected />;
}

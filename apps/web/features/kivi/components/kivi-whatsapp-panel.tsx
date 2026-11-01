'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { MessageCircle, ShieldCheck } from 'lucide-react';
import {
  configureKiviWhatsAppAction,
  type KiviWhatsAppActionState,
} from '@/features/kivi/actions/kivi-whatsapp.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const INITIAL: KiviWhatsAppActionState = { success: false, message: null };

export function KiviWhatsAppPanel({
  linked,
  channel,
}: {
  linked: boolean;
  channel: 'connected' | 'disconnected' | 'unavailable';
}): React.JSX.Element {
  const t = useTranslations('KiviMessaging');
  const [token, setToken] = useState('');
  const [phone, setPhone] = useState('');
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);
  const [state, action, pending] = useActionState(
    async (previous: KiviWhatsAppActionState, data: FormData): Promise<KiviWhatsAppActionState> => {
      const result = await configureKiviWhatsAppAction(previous, data);
      if (result.success && result.connected !== undefined) setToken('');
      if (data.get('operation') === 'disconnect') {
        setDisconnectError(result.success ? null : result.message);
        if (result.success) setDisconnectOpen(false);
      }
      return result;
    },
    INITIAL,
  );
  const [editedState, setEditedState] = useState<KiviWhatsAppActionState | null>(null);
  const errors = editedState === state ? undefined : state.fieldErrors;
  // Secrets stay in the mounted browser form on rejection and never enter action state.
  return (
    <Card className="shadow-none">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <MessageCircle aria-hidden="true" className="size-5" />
            <h2>{t('title')}</h2>
          </CardTitle>
          <Badge variant="secondary">
            {channel === 'connected'
              ? t('channelConnected')
              : channel === 'disconnected'
                ? t('channelDisconnected')
                : t('statusUnknown')}
          </Badge>
        </div>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {t('security')}
        </p>
        {!linked && (
          <p role="status" className="rounded-lg border bg-muted/40 p-4 text-sm">
            {t('linkFirst')}
          </p>
        )}
        <form
          action={action}
          noValidate
          aria-busy={pending}
          className="space-y-4"
          onChange={(): void => setEditedState(state)}
        >
          <fieldset disabled={!linked || pending} className="min-w-0 space-y-4 disabled:opacity-60">
            <div className="space-y-2">
              <Label htmlFor="whatsapp-phone-id">{t('phoneNumberId')}</Label>
              <Input
                id="whatsapp-phone-id"
                name="phoneNumberId"
                className="min-h-11"
                value={phone}
                onChange={(event): void => setPhone(event.target.value)}
                autoComplete="off"
                maxLength={64}
                aria-invalid={Boolean(errors?.phoneNumberId)}
                aria-describedby="whatsapp-phone-help"
              />
              <p
                id="whatsapp-phone-help"
                className={
                  errors?.phoneNumberId
                    ? 'text-sm text-destructive'
                    : 'text-sm text-muted-foreground'
                }
              >
                {errors?.phoneNumberId ?? t('phoneHelp')}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp-token">{t('token')}</Label>
              <Input
                id="whatsapp-token"
                name="token"
                type="password"
                className="min-h-11"
                value={token}
                onChange={(event): void => setToken(event.target.value)}
                autoComplete="new-password"
                maxLength={1024}
                spellCheck={false}
                aria-invalid={Boolean(errors?.token)}
                aria-describedby="whatsapp-token-help"
              />
              <p
                id="whatsapp-token-help"
                className={
                  errors?.token ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'
                }
              >
                {errors?.token ?? t('tokenHelp')}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" name="operation" value="connect" className="min-h-11">
                {pending ? t('working') : t('save')}
              </Button>
              <Button
                type="submit"
                name="operation"
                value="validate"
                variant="outline"
                className="min-h-11"
              >
                {t('validate')}
              </Button>
            </div>
          </fieldset>
          {state.message && editedState !== state && (
            <p
              role={state.success ? 'status' : 'alert'}
              className={`rounded-lg border p-3 text-sm ${state.success ? 'border-success/30 text-success' : 'border-destructive/30 text-destructive'}`}
            >
              {state.message}
            </p>
          )}
          {linked && (
            <Dialog
              open={disconnectOpen}
              onOpenChange={(open: boolean): void => {
                if (!pending) {
                  setDisconnectOpen(open);
                  setDisconnectError(null);
                }
              }}
            >
              <DialogTrigger
                render={
                  <Button type="button" variant="ghost" className="min-h-11" disabled={pending} />
                }
              >
                {t('disconnect')}
              </DialogTrigger>
              <DialogContent closeLabel={t('cancel')} showCloseButton={!pending}>
                <DialogHeader>
                  <DialogTitle>{t('disconnect')}</DialogTitle>
                  <DialogDescription>{t('disconnectHelp')}</DialogDescription>
                </DialogHeader>
                {disconnectError && (
                  <p role="alert" className="text-sm text-destructive">
                    {disconnectError}
                  </p>
                )}
                <Button
                  type="submit"
                  name="operation"
                  value="disconnect"
                  form="whatsapp-disconnect"
                  variant="destructive"
                  className="min-h-11"
                  disabled={pending}
                >
                  {t('confirmDisconnect')}
                </Button>
              </DialogContent>
            </Dialog>
          )}
        </form>
        <form id="whatsapp-disconnect" action={action} />
      </CardContent>
    </Card>
  );
}

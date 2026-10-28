'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { KiviNotificationSettings } from '@canaldigital/packages/core';
import {
  configureKiviNotificationsAction,
  type KiviNotificationsActionState,
} from '@/features/kivi/actions/kivi-notifications.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const INITIAL: KiviNotificationsActionState = { success: false, message: null };

export function KiviNotificationsPanel({
  settings,
  available,
  workerEnabled,
}: {
  settings: KiviNotificationSettings | null;
  available: boolean;
  workerEnabled: boolean;
}): React.JSX.Element {
  const t = useTranslations('KiviMessaging');
  const [state, action, pending] = useActionState(configureKiviNotificationsAction, INITIAL);
  const [values, setValues] = useState(
    settings ?? {
      whatsappEnabled: false,
      widgetEnabled: false,
      templateName: 'order_status_update',
      language: 'es',
    },
  );
  const [edited, setEdited] = useState<KiviNotificationsActionState | null>(null);
  return (
    <Card className="shadow-none">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>
            <h2>{t('automationTitle')}</h2>
          </CardTitle>
          <Badge variant="secondary">
            {workerEnabled ? t('workerEnabled') : t('workerDisabled')}
          </Badge>
        </div>
        <CardDescription>{t('automationHelp')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!available && (
          <p role="status" className="rounded-lg border p-4 text-sm text-muted-foreground">
            {t('notificationUnavailable')}
          </p>
        )}
        {!workerEnabled && (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">{t('workerHelp')}</p>
        )}
        <form
          action={action}
          noValidate
          aria-busy={pending}
          className="space-y-4"
          onChange={(): void => setEdited(state)}
        >
          <fieldset
            disabled={!available || pending}
            className="min-w-0 space-y-5 disabled:opacity-60"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border p-4">
                <input
                  type="checkbox"
                  name="whatsappEnabled"
                  checked={values.whatsappEnabled}
                  onChange={(event): void =>
                    setValues({ ...values, whatsappEnabled: event.target.checked })
                  }
                  className="size-5 accent-primary"
                />
                <span>{t('notifyWhatsApp')}</span>
              </label>
              <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border p-4">
                <input
                  type="checkbox"
                  name="widgetEnabled"
                  checked={values.widgetEnabled}
                  onChange={(event): void =>
                    setValues({ ...values, widgetEnabled: event.target.checked })
                  }
                  className="size-5 accent-primary"
                />
                <span>{t('notifyWidget')}</span>
              </label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notification-template">{t('templateName')}</Label>
              <Input
                id="notification-template"
                name="templateName"
                value={values.templateName}
                onChange={(event): void =>
                  setValues({ ...values, templateName: event.target.value })
                }
                className="min-h-11"
                maxLength={100}
                aria-describedby="notification-template-help"
              />
              <p id="notification-template-help" className="text-sm text-muted-foreground">
                {t('templateHelp')}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notification-language">{t('templateLanguage')}</Label>
              <select
                id="notification-language"
                name="language"
                value={values.language}
                onChange={(event): void => setValues({ ...values, language: event.target.value })}
                className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="es">{t('spanish')}</option>
                <option value="en">{t('english')}</option>
              </select>
            </div>
            <Button type="submit" className="min-h-11">
              {pending ? t('working') : t('saveSettings')}
            </Button>
          </fieldset>
          {state.message && edited !== state && (
            <p role={state.success ? 'status' : 'alert'} className="rounded-lg border p-3 text-sm">
              {state.message}
            </p>
          )}
        </form>
        <p className="text-sm text-muted-foreground">{t('eventHelp')}</p>
      </CardContent>
    </Card>
  );
}

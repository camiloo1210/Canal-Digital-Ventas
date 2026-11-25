'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  setWholesaleAction,
  type WholesaleActionState,
} from '@/features/users/actions/wholesale.actions';

export function WholesaleAccount({ enabled }: { enabled: boolean }): React.JSX.Element {
  const t = useTranslations('WholesaleAccount');
  const [state, action, pending] = useActionState(setWholesaleAction, {
    enabled: null,
    message: null,
    success: false,
  } satisfies WholesaleActionState);
  const active = state.enabled ?? enabled;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm font-medium">{t(active ? 'active' : 'inactive')}</p>
        <form action={action} aria-busy={pending}>
          <input type="hidden" name="enabled" value={String(!active)} />
          <Button
            type="submit"
            variant={active ? 'outline' : 'default'}
            className="min-h-11"
            disabled={pending}
          >
            {t(pending ? 'saving' : active ? 'disable' : 'enable')}
          </Button>
        </form>
        {state.message && (
          <p role={state.success ? 'status' : 'alert'} className="text-sm">
            {state.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

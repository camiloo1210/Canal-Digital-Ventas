'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { RefreshCw } from 'lucide-react';
import type { KiviDeliverySummary } from '@canaldigital/packages/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function KiviDeliveriesPanel({
  deliveries,
}: {
  deliveries: KiviDeliverySummary[] | null;
}): React.JSX.Element {
  const t = useTranslations('KiviMessaging');
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Card className="shadow-none" aria-busy={pending}>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>
            <h2>{t('deliveriesTitle')}</h2>
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={pending}
            onClick={(): void => startTransition((): void => router.refresh())}
          >
            <RefreshCw
              aria-hidden="true"
              className={pending ? 'size-4 motion-safe:animate-spin' : 'size-4'}
            />
            {pending ? t('working') : t('refreshStatus')}
          </Button>
        </div>
        <CardDescription>{t('deliveriesHelp')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {deliveries === null ? (
          <p role="status" className="text-sm text-muted-foreground">
            {t('deliveriesUnavailable')}
          </p>
        ) : deliveries.length === 0 ? (
          <p
            role="status"
            className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground"
          >
            {t('deliveriesEmpty')}
          </p>
        ) : (
          <ul className="divide-y rounded-lg border px-4" aria-label={t('deliveriesTitle')}>
            {deliveries.map((delivery: KiviDeliverySummary): React.JSX.Element => (
              <li
                key={`${delivery.eventId}:${delivery.channel}`}
                className="flex flex-wrap items-start justify-between gap-3 py-4"
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium">
                    {t(delivery.channel === 'whatsapp' ? 'deliveryWhatsApp' : 'deliveryWidget')}
                  </p>
                  <p className="break-all text-xs text-muted-foreground">
                    {t('deliveryEvent', { id: delivery.eventId })}
                  </p>
                  <time
                    dateTime={delivery.updatedAt}
                    className="block text-xs text-muted-foreground"
                  >
                    {format.dateTime(new Date(delivery.updatedAt), {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                      timeZone: 'America/Guayaquil',
                    })}
                  </time>
                </div>
                <Badge
                  variant={
                    delivery.status === 'failed' || delivery.status === 'unknown'
                      ? 'destructive'
                      : 'secondary'
                  }
                >
                  {delivery.status === 'sent'
                    ? t(
                        delivery.channel === 'whatsapp'
                          ? 'deliveryMetaAccepted'
                          : 'deliveryWidgetSaved',
                      )
                    : t(`deliveryStatus.${delivery.status}`)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-muted-foreground">{t('deliveryReconciliation')}</p>
      </CardContent>
    </Card>
  );
}

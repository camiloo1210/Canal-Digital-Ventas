'use client';
import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import type { TrackingReadModel } from '@canaldigital/packages/core';

export function BuyerTrackingTimeline({
  tracking,
}: {
  readonly tracking: TrackingReadModel;
}): React.JSX.Element {
  const t = useTranslations('ShipmentTracking');
  const locale = useLocale();
  const formatter = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Guayaquil',
  });
  return (
    <section className="space-y-3 rounded-lg border bg-muted/20 p-4" aria-label={t('title')}>
      <h3 className="text-sm font-semibold">{t('title')}</h3>
      <p className="text-sm text-muted-foreground">{t('sandbox')}</p>
      <p className="text-sm" role="status">
        {t(`state.${tracking.state}`)}
      </p>
      {tracking.lastSuccessfulAt && (
        <p className="text-sm text-muted-foreground">
          {t('lastUpdated', { date: formatter.format(new Date(tracking.lastSuccessfulAt)) })}
        </p>
      )}
      {tracking.events.length > 0 && (
        <details className="group rounded-md border bg-background/70">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-md px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">
              {t('showEvents', { count: tracking.events.length })}
            </span>
            <span className="hidden group-open:inline">{t('hideEvents')}</span>
            <ChevronDown
              className="size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
              aria-hidden="true"
            />
          </summary>
          <ol className="mx-4 mb-4 mt-1 space-y-3 border-l border-border pl-4">
            {tracking.events.map((event, index): React.JSX.Element => (
              <li
                key={`${event.occurredAt ?? event.dateOnly}-${index}`}
                className="space-y-1 text-sm"
              >
                <p className="font-medium">{t(`event.${event.status}`)}</p>
                {event.occurredAt ? (
                  <time dateTime={event.occurredAt} className="text-muted-foreground">
                    {formatter.format(new Date(event.occurredAt))}
                  </time>
                ) : event.dateOnly ? (
                  <time dateTime={event.dateOnly} className="text-muted-foreground">
                    {event.dateOnly}
                  </time>
                ) : null}
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}

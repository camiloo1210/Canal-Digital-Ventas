'use client';
import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
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
        <ol className="space-y-3 border-l border-border pl-4">
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
      )}
    </section>
  );
}

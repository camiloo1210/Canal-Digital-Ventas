import * as React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { BuyerTrackingTimeline } from '@/features/orders/components/buyer-tracking-timeline';

function render(
  locale: string,
  tracking: React.ComponentProps<typeof BuyerTrackingTimeline>['tracking'] = {
    state: 'stale',
    lastSuccessfulAt: '2026-11-09T10:00:00Z',
    events: [{ status: 'delivered', occurredAt: '2026-11-09T09:00:00Z', dateOnly: null }],
  },
): string {
  const messages = JSON.parse(
    readFileSync(resolve('apps/web/messages', `${locale}.json`), 'utf8'),
  ) as AbstractIntlMessages;
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <BuyerTrackingTimeline tracking={tracking} />
    </NextIntlClientProvider>,
  );
}
describe('buyer tracking timeline', (): void => {
  it('explains stale tracking and displays confirmed carrier events in Spanish and English', (): void => {
    expect(render('es')).toContain('puede estar desactualizada');
    expect(render('es')).toContain('Entregado');
    expect(render('en')).toContain('may be out of date');
    expect(render('en')).toContain('Delivered');
  });
  it('keeps carrier events collapsed with an accessible count in both languages', (): void => {
    const spanish = render('es');
    expect(spanish).toContain('<details');
    expect(spanish).not.toMatch(/<details[^>]*\sopen(?:=|\s|>)/);
    expect(spanish).toContain('Ver 1 actualización de la transportadora');
    expect(render('en')).toContain('View 1 carrier update');
  });
  it('shows pending without inventing events or a last successful consultation', (): void => {
    const html = render('es', { state: 'pending', lastSuccessfulAt: null, events: [] });
    expect(html).toContain('Esperando la primera consulta.');
    expect(html).toContain('Datos de prueba proporcionados por FedEx');
    expect(html).not.toContain('\u00daltima consulta:');
    expect(html).not.toContain('<ol');
  });
  it('shows a date-only carrier event without inventing an hour', (): void => {
    const html = render('es', {
      state: 'current',
      lastSuccessfulAt: '2026-11-09T10:00:00Z',
      events: [{ status: 'in_transit', occurredAt: null, dateOnly: '2026-11-08' }],
    });
    expect(html).toContain('En tr\u00e1nsito');
    expect(html).toContain('<time dateTime="2026-11-08"');
    expect(html).toContain('>2026-11-08</time>');
  });
  it('makes a disabled connection explicit without presenting it as live', (): void => {
    const html = render('es', { state: 'disabled', lastSuccessfulAt: null, events: [] });
    expect(html).toContain('El seguimiento est\u00e1 desactivado.');
    expect(html).not.toContain('Informaci\u00f3n consultada a FedEx.');
  });
});

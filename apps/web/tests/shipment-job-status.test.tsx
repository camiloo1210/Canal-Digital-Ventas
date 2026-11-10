import * as React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { ShipmentJobStatus } from '@/features/orders/components/shipment-job-status';
import { SHIPMENT_JOB_REASONS } from '@/features/orders/constants/shipment-job-reasons';

vi.mock('@/features/orders/actions/retry-shipment.actions', (): object => ({
  retryShipmentAction: vi.fn(),
}));
vi.mock('@/features/orders/actions/label-download.actions', (): object => ({
  downloadLabelAction: vi.fn(),
}));
vi.mock('@/features/dashboard/components/tenant-scope', (): object => ({
  TenantIdField: (): null => null,
}));

type Job = React.ComponentProps<typeof ShipmentJobStatus>['job'];

function load(locale: 'es' | 'en'): AbstractIntlMessages {
  return JSON.parse(
    readFileSync(resolve('apps/web/messages/' + locale + '.json'), 'utf8'),
  ) as AbstractIntlMessages;
}

function render(job: Job, locale: 'es' | 'en' = 'es'): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={load(locale)}>
      <ShipmentJobStatus orderId="order" job={job} />
    </NextIntlClientProvider>,
  );
}

const base = { reason: null, hasLabel: false, providerTrackingNumber: null };

describe('shipment job status', (): void => {
  it('renders queued and creating without actions', (): void => {
    const queued = render({ ...base, state: 'queued' });
    expect(queued).toContain('Preparando la etiqueta');
    expect(queued).not.toContain('Reintentar');
    expect(render({ ...base, state: 'creating' })).toContain('Creando el envío');
  });
  it('offers the label download only when a label is stored', (): void => {
    expect(render({ ...base, state: 'done', hasLabel: true })).toContain('Descargar etiqueta');
    const without = render({ ...base, state: 'done', reason: 'LABEL_UNAVAILABLE' });
    expect(without).not.toContain('Descargar etiqueta');
    expect(without).toContain('Etiqueta no disponible');
  });
  it.each(['needs_attention', 'failed'] as const)(
    'shows a localized reason and retry for %s',
    (state): void => {
      const html = render({ ...base, state, reason: 'MISSING_ORIGIN' });
      expect(html).toContain('dirección de origen');
      expect(html).not.toContain('MISSING_ORIGIN');
      expect(html).toContain('Reintentar');
    },
  );
  it('warns before retrying an ambiguous result', (): void => {
    const html = render({ ...base, state: 'needs_attention', reason: 'AMBIGUOUS_RESULT' });
    expect(html).toContain('Reintentar');
    expect(html).toContain('segundo envío');
  });
  it('never offers retry once the carrier returned a tracking number', (): void => {
    const html = render({
      ...base,
      state: 'needs_attention',
      reason: 'AMBIGUOUS_RESULT',
      providerTrackingNumber: '794600000001',
    });
    expect(html).toContain('794600000001');
    expect(html).toContain('formulario de envío manual');
    expect(html).not.toContain('Reintentar');
  });
  it.each(['es', 'en'] as const)(
    'explains an already recorded shipment without offering retry (%s)',
    (locale): void => {
      const html = render(
        { ...base, state: 'needs_attention', reason: 'SHIPMENT_ALREADY_RECORDED' },
        locale,
      );
      expect(html).not.toContain('SHIPMENT_ALREADY_RECORDED');
      expect(html).toContain(
        locale === 'es' ? 'ya tiene un número de guía' : 'already has a tracking number',
      );
      expect(html).not.toContain(locale === 'es' ? 'Reintentar' : 'Retry');
    },
  );
  it('localizes the already recorded reason code', (): void => {
    expect(SHIPMENT_JOB_REASONS).toContain('SHIPMENT_ALREADY_RECORDED');
  });
  it('falls back to a generic message for unknown or null reasons', (): void => {
    const html = render({ ...base, state: 'failed', reason: 'SHIPMENT.INVALID' });
    expect(html).toContain('motivo no identificado');
    expect(html).not.toContain('SHIPMENT.INVALID');
    expect(render({ ...base, state: 'failed' })).toContain('motivo no identificado');
  });
  it('localizes every reason code in both languages', (): void => {
    for (const locale of ['es', 'en'] as const) {
      const reasons = (load(locale).SellerOrders as { shipmentJob: { reasons: object } })
        .shipmentJob.reasons;
      for (const code of SHIPMENT_JOB_REASONS) expect(reasons).toHaveProperty(code);
      expect(reasons).toHaveProperty('UNKNOWN');
    }
  });
  it('keeps identical message keys in es and en', (): void => {
    const keys = (value: unknown, prefix = ''): string[] =>
      typeof value === 'object' && value !== null
        ? Object.entries(value).flatMap(([k, v]): string[] => keys(v, prefix + k + '.'))
        : [prefix];
    const pick = (locale: 'es' | 'en'): string[] =>
      keys((load(locale).SellerOrders as { shipmentJob: object }).shipmentJob).sort();
    expect(pick('en')).toEqual(pick('es'));
  });
});

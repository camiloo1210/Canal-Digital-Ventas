import * as React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { SellerTrackingForm } from '@/features/orders/components/seller-tracking-form';
vi.mock('@/features/orders/actions/enable-tracking.actions', (): object => ({
  enableTrackingAction: vi.fn(),
  disableTrackingAction: vi.fn(),
}));
vi.mock('@/features/dashboard/components/tenant-scope', (): object => ({
  TenantIdField: (): null => null,
}));
describe('seller tracking form', (): void => {
  it('offers to disable an active tracker', (): void => {
    const messages = JSON.parse(
      readFileSync(resolve('apps/web/messages/es.json'), 'utf8'),
    ) as AbstractIntlMessages;
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="es" messages={messages}>
        <SellerTrackingForm orderId="order" version={1} active />
      </NextIntlClientProvider>,
    );
    expect(html).toContain('Desactivar seguimiento');
  });
  it('describes the sandbox and explicitly selects FedEx', (): void => {
    const messages = JSON.parse(
      readFileSync(resolve('apps/web/messages/es.json'), 'utf8'),
    ) as AbstractIntlMessages;
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="es" messages={messages}>
        <SellerTrackingForm orderId="order" version={1} />
      </NextIntlClientProvider>,
    );
    expect(html).toContain('FedEx');
    expect(html).toContain('prueba');
  });
});

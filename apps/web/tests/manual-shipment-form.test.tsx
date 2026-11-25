import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import es from '@/messages/es.json';
import { ManualShipmentForm } from '@/features/orders/components/manual-shipment-form';

vi.mock('@/features/dashboard/components/tenant-scope', (): object => ({
  TenantIdField: (): null => null,
}));
vi.mock('@/features/orders/actions/register-manual-shipment.actions', (): object => ({
  registerManualShipmentAction: (): void => undefined,
}));

function renderForm(recoveryRequired: boolean): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="es" messages={es}>
      <ManualShipmentForm
        orderId="order-1"
        version={2}
        carrier="FedEx"
        trackingNumber="12345"
        recoveryRequired={recoveryRequired}
      />
    </NextIntlClientProvider>,
  );
}

describe('shipment form', (): void => {
  it('keeps the saved tracking number in the form while manual entry is collapsed', (): void => {
    const html = renderForm(false);
    expect(html).toContain('Guardar envío');
    expect(html).toContain('name="trackingNumber"');
    expect(html).toContain('value="12345"');
    expect(html).not.toMatch(/<details[^>]*\sopen(?:=|\s|>)/);
  });

  it('opens manual tracking entry when recovery is required', (): void => {
    expect(renderForm(true)).toMatch(/<details[^>]*\sopen=""/);
  });
});

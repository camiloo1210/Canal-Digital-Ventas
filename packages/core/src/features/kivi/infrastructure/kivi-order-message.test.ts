import { describe, expect, it } from 'vitest';
import { renderKiviOrderMessage } from '@/kivi/infrastructure/kivi-order-message';
import type { NotificationCopy } from '@/notifications/application/ports/out/notification.ports';
import type { NotificationOrderDetails } from '@/notifications/application/ports/out/notification-order-details';

const copy: NotificationCopy = {
  subjects: {
    confirmed: 'Compra confirmada: pedido {orderNumber}',
    paid: 'Pago recibido: pedido {orderNumber}',
    processing: 'Pedido en preparación: {orderNumber}',
    shipped: 'Pedido enviado: {orderNumber}',
    shipment_updated: 'Datos de envío actualizados: {orderNumber}',
    delivered: 'Pedido entregado: {orderNumber}',
    cancelled: 'Compra cancelada: pedido {orderNumber}',
    refunded: 'Reembolso registrado: {orderNumber}',
  },
  body: '{tenantName}: {status}.',
  intros: {
    confirmed: 'Gracias por elegir {tenantName}.',
    paid: 'Recibimos el pago.',
    processing: 'En {tenantName} estamos preparando tu pedido.',
    shipped: 'Tu pedido ya fue enviado.',
    shipment_updated: 'Actualizamos el envío.',
    delivered: 'Tu pedido fue entregado.',
    cancelled: 'Tu pedido fue cancelado.',
    refunded: 'Registramos el reembolso.',
  },
  presentation: {
    eyebrow: 'ACTUALIZACIÓN DE TU PEDIDO',
    order: 'Pedido',
    placedOn: 'Realizado el',
    summary: 'Lo que incluye tu pedido',
    quantity: 'Cantidad',
    subtotal: 'Subtotal',
    tax: 'Impuestos',
    discount: 'Descuento',
    shipping: 'Envío',
    total: 'Total',
    delivery: 'Dirección de entrega',
    customer: 'Cliente',
    viewOrder: 'Ver pedido',
    visitStore: 'Visitar la tienda',
    support: '¿Necesitas ayuda? Contacta con la tienda:',
    footer: 'Recibes este mensaje por un pedido en {tenantName}.',
    moreItems: 'Y {count} productos más. Consulta el pedido para ver el detalle completo.',
    stock: 'Revisar inventario',
    availability: 'unidades disponibles',
    sku: 'SKU',
  },
};

function order(overrides: Partial<NotificationOrderDetails> = {}): NotificationOrderDetails {
  return {
    orderId: '11111111-1111-4111-8111-111111111111',
    tenantSlug: 'mi-tienda',
    logoUrl: null,
    contactEmail: 'ayuda@tienda.test',
    customerName: 'Camilo Andrés Brazales',
    createdAt: '2026-11-11T14:00:00.000Z',
    currency: 'USD',
    subtotalCents: 390,
    taxAmountCents: 0,
    discountAmountCents: 0,
    shippingCostCents: 500,
    totalAmountCents: 890,
    shippingAddress: 'Calle 1, Quito, Pichincha, 170101, EC',
    items: [
      {
        name: 'borrador',
        sku: 'BOR-1',
        quantity: 13,
        unitPriceCents: 30,
        subtotalCents: 390,
        imageUrl: null,
      },
    ],
    ...overrides,
  };
}

const plain = (value: string): string => value.replaceAll(' ', ' ');

const base = {
  type: 'processing' as const,
  locale: 'es' as const,
  copy,
  orderNumber: 'ORD-HCVM-RKDM-VCHD',
  appUrl: 'https://canal.example',
};

describe('renderKiviOrderMessage', (): void => {
  it('greets the buyer by first name and carries the same data as the email', (): void => {
    const text = plain(renderKiviOrderMessage({ ...base, order: order() }));
    expect(text).toContain('Hola Camilo,');
    expect(text).toContain('*Pedido en preparación: ORD-HCVM-RKDM-VCHD*');
    expect(text).toContain('En {tenantName} estamos preparando tu pedido.');
    expect(text).toContain('Realizado el: 11 de noviembre de 2026');
    expect(text).toContain('• borrador (BOR-1) — Cantidad: 13 × US$ 0,30 — US$ 3,90');
    expect(text).toContain('Subtotal: US$ 3,90');
    expect(text).toContain('Envío: US$ 5,00');
    expect(text).toContain('*Total: US$ 8,90*');
    expect(text).toContain('*Dirección de entrega:* Calle 1, Quito, Pichincha, 170101, EC');
    expect(text).toContain(
      'Ver pedido: https://canal.example/purchases/11111111-1111-4111-8111-111111111111',
    );
    expect(text).toContain('Visitar la tienda: https://canal.example/store/mi-tienda');
    expect(text).toContain('Contacta con la tienda: ayuda@tienda.test');
  });

  it('omits a zero discount and shows a real one as negative', (): void => {
    expect(renderKiviOrderMessage({ ...base, order: order() })).not.toContain('Descuento');
    const text = plain(
      renderKiviOrderMessage({
        ...base,
        order: order({ discountAmountCents: 100, totalAmountCents: 790 }),
      }),
    );
    expect(text).toContain('Descuento: -US$ 1,00');
  });

  it('falls back to the headline and intro when the order details are unavailable', (): void => {
    const text = renderKiviOrderMessage({ ...base, order: undefined });
    expect(text).toBe(
      '*Pedido en preparación: ORD-HCVM-RKDM-VCHD*\n\nEn {tenantName} estamos preparando tu pedido.',
    );
  });

  it('omits links when no public app URL is configured', (): void => {
    const text = renderKiviOrderMessage({ ...base, order: order(), appUrl: undefined });
    expect(text).not.toContain('https://');
  });

  it('keeps the message under the WhatsApp text limit and reports the hidden products', (): void => {
    const items = Array.from(
      { length: 20 },
      (_, index): NotificationOrderDetails['items'][number] => ({
        name: `Producto ${index} ${'x'.repeat(240)}`,
        sku: `SKU-${index}`,
        quantity: 1,
        unitPriceCents: 100,
        subtotalCents: 100,
        imageUrl: null,
      }),
    );
    const text = renderKiviOrderMessage({
      ...base,
      order: order({ items, shippingAddress: 'd'.repeat(600) }),
    });
    expect(text.length).toBeLessThanOrEqual(4096);
    expect(text).toMatch(/Y \d+ productos más\./);
    expect(text).toContain('*Total:');
  });

  it('renders English money and dates for the English locale', (): void => {
    const text = renderKiviOrderMessage({
      ...base,
      locale: 'en',
      copy: {
        ...copy,
        subjects: { ...copy.subjects, processing: 'Order in preparation: {orderNumber}' },
        presentation: { ...copy.presentation!, total: 'Total', placedOn: 'Placed on' },
      },
      order: order(),
    });
    expect(text).toContain('Hi Camilo,');
    expect(text).toContain('Placed on: November 11, 2026');
    expect(text).toContain('*Total: $8.90*');
  });

  it('strips line breaks from buyer-controlled text so it cannot forge message sections', (): void => {
    const text = renderKiviOrderMessage({
      ...base,
      order: order({ customerName: 'Eve\n*Total: US$0.01*' }),
    });
    expect(text).not.toContain('\n*Total: US$0.01*');
  });
});

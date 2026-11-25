import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { BuyerOrderReadModel } from '@canaldigital/packages/core';
import { formatMoney } from '@/lib/money';

export function BuyerOrderPrintSummary({
  order,
}: {
  readonly order: BuyerOrderReadModel;
}): React.JSX.Element {
  const detail = useTranslations('Orders.detail');
  const card = useTranslations('Orders.card');
  const status = useTranslations('Orders.status');
  const storefront = useTranslations('Storefront');
  const locale = useLocale();
  const money = (cents: number): string => formatMoney(cents, order.currency, locale);
  const normalized = order.status.toLowerCase();
  const statusKey = [
    'draft',
    'confirmed',
    'pending_payment',
    'paid',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
    'refunded',
  ].includes(normalized)
    ? normalized
    : 'unknown';
  const date = new Intl.DateTimeFormat(locale, {
    dateStyle: 'long',
    timeZone: 'America/Guayaquil',
  }).format(new Date(order.createdAt));

  return (
    <article className="buyer-order-print hidden text-black print:block">
      <header className="border-b-2 border-black pb-4">
        <p className="text-sm font-semibold">{storefront('auth.platform')}</p>
        <h1 className="mt-2 text-2xl font-bold">{detail('summaryTitle')}</h1>
        <p className="mt-1 text-sm">{detail('printNote')}</p>
      </header>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-3 py-5 text-sm">
        <div>
          <dt className="font-semibold">{detail('orderNumber')}</dt>
          <dd>{order.orderNumber}</dd>
        </div>
        <div>
          <dt className="font-semibold">{card('store')}</dt>
          <dd>{order.tenantName}</dd>
        </div>
        <div>
          <dt className="font-semibold">{detail('placedOn')}</dt>
          <dd>{date}</dd>
        </div>
        <div>
          <dt className="font-semibold">{detail('printStatus')}</dt>
          <dd>{status(statusKey)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="font-semibold">{card('deliveryAddress')}</dt>
          <dd>{order.shippingAddress ?? detail('addressUnavailable')}</dd>
        </div>
        {order.shipment?.carrier && (
          <div>
            <dt className="font-semibold">{card('shipmentCarrier')}</dt>
            <dd>{order.shipment.carrier}</dd>
          </div>
        )}
        {order.shipment?.trackingNumber && (
          <div>
            <dt className="font-semibold">{card('shipmentTracking')}</dt>
            <dd className="break-all">{order.shipment.trackingNumber}</dd>
          </div>
        )}
      </dl>
      <section className="border-t border-black pt-4">
        <h2 className="text-base font-bold">{card('items')}</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-black">
              <th className="pb-2">{card('items')}</th>
              <th className="pb-2 text-right">{card('total')}</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item): React.JSX.Element => (
              <tr key={item.id} className="border-b border-gray-300 align-top">
                <td className="py-2">
                  <p className="font-semibold">{item.productName}</p>
                  <p>
                    {card('quantityAt', {
                      quantity: item.quantity,
                      price: money(item.unitPriceCents),
                    })}
                  </p>
                </td>
                <td className="py-2 text-right tabular-nums">{money(item.subtotalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <dl className="ml-auto mt-5 w-full max-w-xs space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt>{card('subtotal')}</dt>
          <dd>{money(order.subtotalCents)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>{card('tax')}</dt>
          <dd>{money(order.taxAmountCents)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>{card('shipping')}</dt>
          <dd>{money(order.shippingCostCents)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-black pt-2 font-bold">
          <dt>{card('total')}</dt>
          <dd>{money(order.totalAmountCents)}</dd>
        </div>
      </dl>
      <p className="mt-5 text-sm">
        <span className="font-semibold">{card('paymentTitle')}: </span>
        {card(`paymentStatus.${order.paymentStatus ?? 'unavailable'}`)}
      </p>
    </article>
  );
}

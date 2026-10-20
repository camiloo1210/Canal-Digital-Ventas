import { getLocale, getTranslations } from 'next-intl/server';
import type { SellerOrderReadModel } from '@canaldigital/packages/core';
import { OrderStatusBadge } from '@/features/orders/components/order-status-badge';
import { SellerOrderStatusForm } from '@/features/orders/components/seller-order-status-form';
import { formatMoney } from '@/lib/money';

export async function SellerOrderDetails({
  order,
}: {
  order: SellerOrderReadModel;
}): Promise<React.JSX.Element> {
  const [t, locale] = await Promise.all([getTranslations('AdminOrders'), getLocale()]);
  const date = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Guayaquil',
  });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <OrderStatusBadge status={order.status} />
        <time dateTime={order.createdAt} className="text-sm text-muted-foreground">
          {date.format(new Date(order.createdAt))}
        </time>
      </div>
      <dl className="grid gap-4 rounded-lg border p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">{t('customer')}</dt>
          <dd className="mt-1 break-words font-medium">{order.customerName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('address')}</dt>
          <dd className="mt-1 break-words leading-relaxed">{order.shippingAddress}</dd>
        </div>
      </dl>
      <section aria-labelledby={'order-products-' + order.id}>
        <h3 id={'order-products-' + order.id} className="mb-3 text-sm font-semibold">
          {t('products')}
        </h3>
        <ul className="divide-y rounded-lg border px-4">
          {order.items.map((item): React.JSX.Element => (
            <li key={item.id} className="flex justify-between gap-4 py-3 text-sm">
              <span className="min-w-0 break-words">{item.productName}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {t('quantity', { count: item.quantity })}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <div className="flex items-center justify-between gap-4 border-t pt-4">
        <span className="text-sm text-muted-foreground">{t('total')}</span>
        <strong className="text-xl tabular-nums">
          {formatMoney(order.totalAmountCents, order.currency, locale)}
        </strong>
      </div>
      {order.nextStatus ? (
        <SellerOrderStatusForm
          key={order.id + ':' + order.version}
          orderId={order.id}
          version={order.version}
          nextStatus={order.nextStatus}
        />
      ) : (
        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{t('noTransition')}</p>
      )}
      <p className="text-xs text-muted-foreground">{t('timezone')}</p>
    </div>
  );
}

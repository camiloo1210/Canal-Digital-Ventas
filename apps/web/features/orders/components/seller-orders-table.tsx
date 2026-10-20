import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import type { SellerOrderReadModel } from '@canaldigital/packages/core';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { OrderStatusBadge } from '@/features/orders/components/order-status-badge';
import {
  sellerOrdersHref,
  type SellerOrdersQuery,
} from '@/features/orders/queries/seller-orders-query';
import { formatMoney } from '@/lib/money';

export async function SellerOrdersTable({
  orders,
  query,
}: {
  orders: readonly SellerOrderReadModel[];
  query: SellerOrdersQuery;
}): Promise<React.JSX.Element> {
  const [t, locale] = await Promise.all([getTranslations('AdminOrders'), getLocale()]);
  const date = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Guayaquil',
  });
  return (
    <>
      <div className="hidden xl:block">
        <Table className="table-fixed">
          <caption className="sr-only">{t('title')}</caption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%] pl-5" scope="col">
                {t('order')}
              </TableHead>
              <TableHead className="w-[30%]" scope="col">
                {t('customer')}
              </TableHead>
              <TableHead className="w-[20%]" scope="col">
                {t('status')}
              </TableHead>
              <TableHead className="pr-5 text-right" scope="col">
                {t('total')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order): React.JSX.Element => (
              <TableRow id={'order-' + order.id} key={order.id} className="scroll-mt-6">
                <TableCell className="py-3 pl-5">
                  <Link
                    id={'order-link-' + order.id}
                    href={sellerOrdersHref(query, { order: order.id })}
                    scroll={false}
                    className="inline-flex min-h-11 flex-col justify-center gap-1 font-medium underline-offset-4 hover:underline"
                  >
                    {order.orderNumber}
                    <time
                      dateTime={order.createdAt}
                      className="text-xs font-normal text-muted-foreground"
                    >
                      {date.format(new Date(order.createdAt))}
                    </time>
                  </Link>
                </TableCell>
                <TableCell className="whitespace-normal break-words">
                  {order.customerName}
                </TableCell>
                <TableCell>
                  <OrderStatusBadge status={order.status} />
                </TableCell>
                <TableCell className="pr-5 text-right whitespace-normal font-medium tabular-nums">
                  {formatMoney(order.totalAmountCents, order.currency, locale)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="divide-y xl:hidden">
        {orders.map((order): React.JSX.Element => (
          <li key={order.id} className="space-y-3 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link
                id={'order-mobile-link-' + order.id}
                href={sellerOrdersHref(query, { order: order.id })}
                scroll={false}
                className="inline-flex min-h-11 items-center text-sm font-semibold underline-offset-4 hover:underline"
              >
                {order.orderNumber}
              </Link>
              <span className="text-sm font-semibold tabular-nums">
                {formatMoney(order.totalAmountCents, order.currency, locale)}
              </span>
            </div>
            <div className="flex flex-wrap justify-between gap-3">
              <p className="min-w-0 break-words text-sm">{order.customerName}</p>
              <OrderStatusBadge status={order.status} />
            </div>
            <time dateTime={order.createdAt} className="block text-xs text-muted-foreground">
              {date.format(new Date(order.createdAt))}
            </time>
          </li>
        ))}
      </ul>
    </>
  );
}

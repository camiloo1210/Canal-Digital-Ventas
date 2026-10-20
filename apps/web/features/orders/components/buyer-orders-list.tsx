'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { BuyerOrderReadModel } from '@canaldigital/packages/core';
import { BuyerOrderCard } from '@/features/orders/components/buyer-order-card';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty';

interface BuyerOrdersListProps {
  orders: BuyerOrderReadModel[];
  paymentsEnabled?: boolean;
}

export function BuyerOrdersList({
  orders,
  paymentsEnabled = false,
}: BuyerOrdersListProps): React.JSX.Element {
  const tb = useTranslations('BuyerDashboard');

  if (orders.length === 0) {
    return (
      <Empty className="min-h-64 rounded-xl border border-dashed bg-muted/20">
        <EmptyHeader>
          <EmptyTitle>{tb('empty_purchases')}</EmptyTitle>
          <EmptyDescription>{tb('purchases.emptyDescription')}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button nativeButton={false} role="link" className="min-h-11" render={<Link href="/" />}>
            {tb('directory.allStores')}
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order): React.JSX.Element => (
        <BuyerOrderCard key={order.id} order={order} paymentsEnabled={paymentsEnabled} />
      ))}
    </div>
  );
}

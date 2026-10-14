'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { BuyerOrderReadModel } from '@canaldigital/packages/core';
import { BuyerOrderCard } from '@/features/orders/components/buyer-order-card';
import { Card, CardContent } from '@/components/ui/card';
import { ShoppingBag } from 'lucide-react';

interface BuyerOrdersListProps {
  orders: BuyerOrderReadModel[];
}

export function BuyerOrdersList({ orders }: BuyerOrdersListProps): React.JSX.Element {
  const tb = useTranslations('BuyerDashboard');

  if (orders.length === 0) {
    return (
      <Card className="shadow-sm border-border">
        <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground space-y-3">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground/60">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <p className="text-sm">{tb('empty_purchases')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order): React.JSX.Element => (
        <BuyerOrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}

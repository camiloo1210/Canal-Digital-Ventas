import * as React from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getStoreViewerQuery } from '@/features/store/queries/store-viewer.query';
import { BuyerShell } from '@/features/store-directory/components/buyer-shell';
import { BuyerOrderDetail } from '@/features/orders/components/buyer-order-detail';
import type { TrackingReadModel } from '@canaldigital/packages/core';
import { ordersDi } from '@/features/orders/di/orders.di';

export default async function BuyerPurchaseDetailsPage({
  params,
}: {
  readonly params: Promise<{ orderId: string }>;
}): Promise<React.JSX.Element> {
  const { orderId } = await params;
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect('/login?redirectTo=' + encodeURIComponent('/purchases/' + orderId));
  const [viewer, t, order] = await Promise.all([
    getStoreViewerQuery(),
    getTranslations('BuyerDashboard.purchases'),
    ordersDi.resolveBuyerOrderReadRepository().findOrderByBuyerId(user.id, orderId),
  ]);
  if (!order) notFound();
  const trackingSource = ordersDi.resolveBuyerTracking();
  let tracking: TrackingReadModel | null = null;
  let trackingUnavailable = false;
  if (trackingSource) {
    try {
      tracking = await trackingSource.repository.findByBuyer(
        user.id,
        orderId,
        trackingSource.deploymentId,
      );
    } catch {
      trackingUnavailable = true;
    }
  }
  return (
    <BuyerShell active="purchases" viewer={viewer}>
      <div className="space-y-6">
        <Link
          className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4"
          href="/purchases"
        >
          {t('back')}
        </Link>
        <h1 className="text-2xl font-semibold">{t('detailTitle')}</h1>
        <BuyerOrderDetail
          order={order}
          tracking={tracking}
          trackingUnavailable={trackingUnavailable}
          paymentsEnabled={process.env.PAYMENTS_CHECKOUT_UI_ENABLED === 'true'}
        />
      </div>
    </BuyerShell>
  );
}

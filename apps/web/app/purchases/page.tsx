import * as React from 'react';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getStoreViewerQuery } from '@/features/store/queries/store-viewer.query';
import { BuyerShell } from '@/features/store-directory/components/buyer-shell';
import { BuyerOrdersList } from '@/features/orders/components/buyer-orders-list';
import { ordersDi } from '@/features/orders/di/orders.di';

export async function generateMetadata(): Promise<{ title: string }> {
  const t = await getTranslations('BuyerDashboard.purchases');
  return { title: `${t('title')} | Canal Digital` };
}
export default async function BuyerPurchasesPage(): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirectTo=%2Fpurchases');
  const [viewer, t, orders] = await Promise.all([
    getStoreViewerQuery(),
    getTranslations('BuyerDashboard.purchases'),
    ordersDi.resolveBuyerOrderReadRepository().findOrdersByBuyerId(user.id),
  ]);
  return (
    <BuyerShell active="purchases" viewer={viewer}>
      <div className="space-y-8">
        <header className="space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[2rem]">{t('title')}</h1>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
            {t('description')}
          </p>
        </header>
        <BuyerOrdersList
          orders={orders}
          paymentsEnabled={process.env.PAYMENTS_CHECKOUT_UI_ENABLED === 'true'}
        />
      </div>
    </BuyerShell>
  );
}

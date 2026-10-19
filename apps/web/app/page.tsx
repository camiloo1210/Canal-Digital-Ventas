import * as React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { listActiveTenantsQuery } from '@/features/iam/queries/list-active-tenants.query';
import { StoreDirectory } from '@/features/store-directory/components/store-directory';
import { getStoreViewerQuery } from '@/features/store/queries/store-viewer.query';
import { UserNav } from '@/features/iam/components/user-nav';
import { getTranslations } from 'next-intl/server';
import { AppHeader } from '@/components/app-header';

import { ordersDi } from '@/features/orders/di/orders.di';
import { BuyerOrdersList } from '@/features/orders/components/buyer-orders-list';

export const metadata = {
  title: 'My Purchases | Canal Digital',
};

export default async function BuyerDashboardPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<React.JSX.Element> {
  const searchParams = await props.searchParams;
  const page = typeof searchParams.page === 'string' ? Number(searchParams.page) : 1;
  const storeSearch =
    typeof searchParams.storeSearch === 'string'
      ? searchParams.storeSearch.trim().slice(0, 100)
      : '';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const activeTenantsResult = await listActiveTenantsQuery(page, 24, storeSearch);
  const viewer = await getStoreViewerQuery();
  const t = await getTranslations('Storefront');
  const tb = await getTranslations('BuyerDashboard');

  const buyerOrderReadRepo = ordersDi.resolveBuyerOrderReadRepository();
  const orders = await buyerOrderReadRepo.findOrdersByBuyerId(user.id);

  const labels = {
    login: t('login'),
    createAccount: t('createAccount'),
    logout: t('logout'),
    dashboard: t('dashboard'),
    settings: t('settings'),
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader>
        <h1 className="text-xl font-bold text-foreground">{tb('title')}</h1>
        <UserNav viewer={viewer} redirectTo="/" labels={labels} />
      </AppHeader>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12 w-full">
        <StoreDirectory
          result={activeTenantsResult}
          query={storeSearch}
          labels={{
            title: tb('available_stores'),
            empty: tb('empty_stores'),
            visit: tb('visit_store'),
            searchLabel: tb('search_stores_label'),
            searchPlaceholder: tb('search_stores_placeholder'),
            searchButton: tb('search_stores_button'),
            clearSearch: tb('clear_store_search'),
            noResults: tb('no_matching_stores'),
            resultCount: tb('store_results', { count: activeTenantsResult.total }),
            previous: tb('previous_stores'),
            next: tb('next_stores'),
            pagination: tb('store_pagination'),
          }}
        />

        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {tb('recent_purchases')}
            </h2>
            <p className="text-sm text-muted-foreground">{tb('recent_purchases_desc')}</p>
          </div>

          <BuyerOrdersList
            orders={orders}
            paymentsEnabled={process.env.PAYMENTS_CHECKOUT_UI_ENABLED === 'true'}
          />
        </section>
      </main>
    </div>
  );
}

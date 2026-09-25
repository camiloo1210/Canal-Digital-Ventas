import * as React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { listActiveTenantsQuery } from '@/features/iam/queries/list-active-tenants.query';
import { StoreDirectory } from '@/features/store-directory/components/store-directory';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getStoreViewerQuery } from '@/features/store/queries/store-viewer.query';
import { UserNav } from '@/features/iam/components/user-nav';
import { getTranslations } from 'next-intl/server';

export const metadata = {
  title: 'My Purchases | Canal Digital',
};

export default async function BuyerDashboardPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<React.JSX.Element> {
  const searchParams = await props.searchParams;
  const page = searchParams.page ? parseInt(searchParams.page as string, 10) : 1;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const activeTenantsResult = await listActiveTenantsQuery(page, 24);
  const viewer = await getStoreViewerQuery();
  const t = await getTranslations('Storefront');
  const tb = await getTranslations('BuyerDashboard');

  const labels = {
    login: t('login'),
    createAccount: t('createAccount'),
    logout: t('logout'),
    dashboard: t('dashboard'),
    settings: t('settings'),
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-xl font-bold text-foreground">{tb('title')}</h1>
            <UserNav viewer={viewer} redirectTo="/" labels={labels} />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12 w-full">
        <StoreDirectory 
          result={activeTenantsResult} 
          labels={{
            title: tb('available_stores'),
            empty: tb('empty_stores'),
            visit: tb('visit_store')
          }} 
        />

        <section>
          <Card className="shadow-sm border-border">
            <CardHeader className="border-b border-border bg-muted/20">
              <CardTitle className="text-lg text-foreground">{tb('recent_purchases')}</CardTitle>
              <CardDescription>
                {tb('recent_purchases_desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-12 text-center text-muted-foreground">
              {tb('empty_purchases')}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

import { Suspense } from 'react';
import Form from 'next/form';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireDashboardTenant } from '@/features/dashboard/queries/dashboard-context.query';
import {
  parseSellerOrdersQuery,
  sellerOrderStatuses,
  type SellerOrdersSearchParams,
} from '@/features/orders/queries/seller-orders-query';
import { SellerOrdersResults } from '@/features/orders/components/seller-orders-results';
import { PageHeader } from '@/components/page-header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { CatalogSearchButton } from '@/features/dashboard/components/catalog-search-button';
import { CatalogResultsSkeleton } from '@/features/dashboard/components/catalog-results';

export async function SellerOrdersScreen({
  searchParams,
}: {
  searchParams: Promise<SellerOrdersSearchParams>;
}): Promise<React.JSX.Element> {
  const { userId, tenantId } = await requireDashboardTenant();
  const [t, params] = await Promise.all([getTranslations('AdminOrders'), searchParams]);
  const query = parseSellerOrdersQuery(params);
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHeader breadcrumbs={[{ label: t('title'), href: null }]} />
      <div className="space-y-6 px-4 py-6 lg:px-6 lg:py-8">
        <header className="space-y-2">
          <h1
            id="orders-heading"
            tabIndex={-1}
            className="text-2xl font-semibold tracking-tight outline-none sm:text-[2rem]"
          >
            {t('title')}
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground">{t('description')}</p>
        </header>
        <Form
          action="/dashboard/orders"
          role="search"
          aria-label={t('search')}
          key={query.q + ':' + query.status}
          className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4"
        >
          <div className="min-w-0 grow basis-64 space-y-2">
            <Label htmlFor="order-search">{t('search')}</Label>
            <Input
              id="order-search"
              name="q"
              type="search"
              defaultValue={query.q}
              maxLength={200}
              placeholder={t('searchPlaceholder')}
              className="min-h-11"
            />
          </div>
          <div className="w-full space-y-2 sm:w-48">
            <Label htmlFor="order-status">{t('status')}</Label>
            <Select
              name="status"
              defaultValue={query.status}
              items={sellerOrderStatuses.map((status): { value: string; label: string } => ({
                value: status,
                label: t('views.' + status),
              }))}
            >
              <SelectTrigger id="order-status" className="min-h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sellerOrderStatuses.map((status): React.JSX.Element => (
                  <SelectItem key={status} value={status} className="min-h-11">
                    {t('views.' + status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <CatalogSearchButton label={t('apply')} pendingLabel={t('searching')} />
          {(query.q || query.status !== 'all') && (
            <Link
              href="/dashboard/orders"
              className="inline-flex min-h-11 items-center px-2 text-sm font-medium underline-offset-4 hover:underline"
            >
              {t('clear')}
            </Link>
          )}
        </Form>
        <Suspense
          key={JSON.stringify(query)}
          fallback={<CatalogResultsSkeleton label={t('loading')} />}
        >
          <SellerOrdersResults userId={userId} tenantId={tenantId} query={query} />
        </Suspense>
      </div>
    </div>
  );
}

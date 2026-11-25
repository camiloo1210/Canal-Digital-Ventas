import { Suspense } from 'react';
import Form from 'next/form';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireDashboardPermission } from '@/features/dashboard/queries/dashboard-context.query';
import { UserPermission } from '@canaldigital/packages/core';
import {
  parseSellerOrdersQuery,
  sellerOrdersHref,
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
import { TenantScope } from '@/features/dashboard/components/tenant-scope';
import { tenantParam, withTenant } from '@/features/dashboard/utils/tenant-scope';
import { CatalogSearchButton } from '@/features/dashboard/components/catalog-search-button';
import { CatalogResultsSkeleton } from '@/features/dashboard/components/catalog-results';

const quickOrderStatuses = ['all', 'paid', 'processing', 'pending_payment'] as const;

export async function SellerOrdersScreen({
  searchParams,
}: {
  searchParams: Promise<SellerOrdersSearchParams>;
}): Promise<React.JSX.Element> {
  const [t, params] = await Promise.all([getTranslations('AdminOrders'), searchParams]);
  const { userId, tenantId } = await requireDashboardPermission(
    [UserPermission.VIEW_ORDERS, UserPermission.MANAGE_ORDERS],
    tenantParam(params.tenant),
  );
  const query = { ...parseSellerOrdersQuery(params), tenant: tenantId };
  return (
    <TenantScope tenantId={tenantId}>
      <div className="flex min-w-0 flex-1 flex-col">
        <PageHeader breadcrumbs={[{ label: t('title'), href: null }]} />
        <div className="mx-auto w-full max-w-7xl min-w-0 space-y-6 px-4 py-6 lg:px-8 lg:py-8">
          <header className="space-y-2">
            <h1
              id="orders-heading"
              tabIndex={-1}
              className="text-3xl font-semibold tracking-tight text-balance outline-none lg:text-4xl"
            >
              {t('title')}
            </h1>
            <p className="max-w-prose text-sm leading-relaxed text-pretty text-muted-foreground sm:text-[0.9375rem]">
              {t('description')}
            </p>
          </header>
          <nav aria-label={t('quickFilters')} className="flex flex-wrap gap-2">
            {quickOrderStatuses.map((status): React.JSX.Element => (
              <Link
                key={status}
                href={sellerOrdersHref(query, { status, page: 1, order: null })}
                aria-current={query.status === status ? 'page' : undefined}
                className="inline-flex min-h-11 items-center rounded-lg border bg-card px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none aria-[current=page]:border-primary/40 aria-[current=page]:bg-accent aria-[current=page]:font-semibold aria-[current=page]:text-accent-foreground motion-reduce:transition-none"
              >
                {t('views.' + status)}
              </Link>
            ))}
          </nav>
          <Form
            action="/dashboard/orders"
            role="search"
            aria-label={t('search')}
            key={query.q + ':' + query.status + ':' + tenantId}
            className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4"
          >
            <input type="hidden" name="tenant" value={tenantId} />
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
                href={withTenant('/dashboard/orders', tenantId)}
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
    </TenantScope>
  );
}

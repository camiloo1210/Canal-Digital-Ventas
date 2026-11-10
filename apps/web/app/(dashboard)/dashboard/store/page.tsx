import { requireDashboardPermission } from '@/features/dashboard/queries/dashboard-context.query';
import { UserPermission } from '@canaldigital/packages/core';
import { headers } from 'next/headers';
import { getMessages, getTranslations } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import {
  getShippingOriginRepository,
  getStoreSettingsReadRepository,
} from '@/features/store-settings/di/store-settings.di';
import { StoreSettingsForm } from '@/features/store-settings/components/store-settings-form';
import { ShippingOriginForm } from '@/features/store-settings/components/shipping-origin-form';
import { PublicStoreLink } from '@/features/store-settings/components/public-store-link';
import { PageHeader } from '@/components/page-header';
import { TenantScope } from '@/features/dashboard/components/tenant-scope';
import { tenantParam, type TenantSearchParams } from '@/features/dashboard/utils/tenant-scope';

export default async function StoreSettingsPage({
  searchParams,
}: {
  searchParams: Promise<TenantSearchParams>;
}): Promise<React.JSX.Element> {
  const t = await getTranslations('StoreSettings');
  const messages = await getMessages();
  const { userId, tenantId } = await requireDashboardPermission(
    UserPermission.MANAGE_STORE,
    tenantParam((await searchParams).tenant),
  );
  const settings = await getStoreSettingsReadRepository().findForManager(userId, tenantId);
  const shippingOrigin = settings ? await getShippingOriginRepository().find(tenantId) : null;

  const requestHeaders = await headers();
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
  const protocol =
    requestHeaders.get('x-forwarded-proto') ?? (host?.startsWith('localhost') ? 'http' : 'https');
  const publicUrl = settings && host ? `${protocol}://${host}/store/${settings.slug}` : null;

  return (
    <TenantScope tenantId={tenantId}>
      <div className="flex flex-1 flex-col">
        <PageHeader breadcrumbs={[{ label: t('title'), href: null }]} />
        <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 lg:px-6 lg:py-10">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-[2rem]">{t('title')}</h1>
            <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>
          </div>
          {settings ? (
            <NextIntlClientProvider
              messages={{
                StoreSettings: messages.StoreSettings,
                CatalogForms: messages.CatalogForms,
                ShippingOrigin: messages.ShippingOrigin,
              }}
            >
              {publicUrl && <PublicStoreLink url={publicUrl} />}
              <StoreSettingsForm initial={settings} />
              <ShippingOriginForm initial={shippingOrigin} />
            </NextIntlClientProvider>
          ) : (
            <p role="alert">{t('unauthorized')}</p>
          )}
        </div>
      </div>
    </TenantScope>
  );
}

import { requireDashboardTenant } from '@/features/dashboard/queries/dashboard-context.query';
import { headers } from 'next/headers';
import { getMessages, getTranslations } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { getStoreSettingsReadRepository } from '@/features/store-settings/di/store-settings.di';
import { StoreSettingsForm } from '@/features/store-settings/components/store-settings-form';
import { PublicStoreLink } from '@/features/store-settings/components/public-store-link';
import { PageHeader } from '@/components/page-header';

export default async function StoreSettingsPage(): Promise<React.JSX.Element> {
  const t = await getTranslations('StoreSettings');
  const messages = await getMessages();
  const { userId, tenantId } = await requireDashboardTenant();
  const settings = await getStoreSettingsReadRepository().findForManager(userId, tenantId);

  const requestHeaders = await headers();
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
  const protocol =
    requestHeaders.get('x-forwarded-proto') ?? (host?.startsWith('localhost') ? 'http' : 'https');
  const publicUrl = settings && host ? `${protocol}://${host}/store/${settings.slug}` : null;

  return (
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
            }}
          >
            {publicUrl && <PublicStoreLink url={publicUrl} />}
            <StoreSettingsForm initial={settings} />
          </NextIntlClientProvider>
        ) : (
          <p role="alert">{t('unauthorized')}</p>
        )}
      </div>
    </div>
  );
}

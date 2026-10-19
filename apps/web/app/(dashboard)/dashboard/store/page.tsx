import { getMessages, getTranslations } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveTenantQuery } from '@/features/iam/queries/active-tenant.query';
import { getStoreSettingsReadRepository } from '@/features/store-settings/di/store-settings.di';
import { StoreSettingsForm } from '@/features/store-settings/components/store-settings-form';
import { PageHeader } from '@/components/page-header';

export default async function StoreSettingsPage(): Promise<React.JSX.Element> {
  const t = await getTranslations('StoreSettings');
  const messages = await getMessages();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const tenantId = await getActiveTenantQuery(user.id);
  const settings = tenantId
    ? await getStoreSettingsReadRepository().findForManager(user.id, tenantId)
    : null;

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader breadcrumbs={[{ label: t('title'), href: null }]} />
      <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 lg:px-6 lg:py-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>
        </div>
        {settings ? (
          <NextIntlClientProvider messages={{ StoreSettings: messages.StoreSettings }}>
            <StoreSettingsForm initial={settings} />
          </NextIntlClientProvider>
        ) : (
          <p role="alert">{t('unauthorized')}</p>
        )}
      </div>
    </div>
  );
}

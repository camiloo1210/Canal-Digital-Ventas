import { getMessages, getTranslations } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { requireDashboardTenant } from '@/features/dashboard/queries/dashboard-context.query';
import { getKiviConnectionReadRepository } from '@/features/kivi/di/kivi.di';
import { KiviConnectionPanel } from '@/features/kivi/components/kivi-connection-panel';
import { PageHeader } from '@/components/page-header';

export default async function IntegrationsPage(): Promise<React.JSX.Element> {
  const t = await getTranslations('KiviConnection');
  const messages = await getMessages();
  const { userId, tenantId } = await requireDashboardTenant();
  // Owner-only projection: null both when unlinked and when the user is not an owner.
  const connection = await getKiviConnectionReadRepository().findForOwner(userId, tenantId);

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader breadcrumbs={[{ label: t('title'), href: null }]} />
      <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 lg:px-6 lg:py-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[2rem]">{t('title')}</h1>
          <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>
        </div>
        <NextIntlClientProvider messages={{ KiviConnection: messages.KiviConnection }}>
          <KiviConnectionPanel connection={connection} />
        </NextIntlClientProvider>
      </div>
    </div>
  );
}

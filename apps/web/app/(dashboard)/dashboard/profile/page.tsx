import * as React from 'react';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/page-header';
import { getDashboardContextQuery } from '@/features/dashboard/queries/dashboard-context.query';
import { ProfileContent } from '@/features/users/components/profile-content';

export async function generateMetadata(): Promise<{ title: string }> {
  const t = await getTranslations('Profile');
  return { title: t('metadata') };
}

/**
 * Profile inside the dashboard shell. It belongs to the person, not to a business, so it needs no
 * tenant id and never reads one.
 */
export default async function DashboardProfilePage(): Promise<React.JSX.Element> {
  const [context, t] = await Promise.all([getDashboardContextQuery(), getTranslations('Profile')]);
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHeader breadcrumbs={[{ label: t('title'), href: null }]} />
      <div className="px-4 py-6 lg:px-6 lg:py-8">
        <ProfileContent userId={context.userId} email={context.email} />
      </div>
    </div>
  );
}

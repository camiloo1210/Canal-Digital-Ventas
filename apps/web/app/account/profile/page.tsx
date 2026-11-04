import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { getCurrentUserQuery } from '@/features/users/queries/current-user.query';
import { getOwnProfileReadRepository } from '@/features/users/di/users.di';
import { ProfileForm } from '@/features/users/components/profile-form';

export async function generateMetadata(): Promise<{ title: string }> {
  const t = await getTranslations('Profile');
  return { title: t('metadata') };
}

export default async function ProfilePage(): Promise<React.JSX.Element> {
  const user = await getCurrentUserQuery();
  if (!user) redirect('/login?redirectTo=%2Faccount%2Fprofile');
  const [t, profile] = await Promise.all([
    getTranslations('Profile'),
    getOwnProfileReadRepository().findForUser(user.id),
  ]);
  return (
    <main className="mx-auto w-full max-w-xl space-y-6 px-4 py-8">
      <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t('back')}
      </Link>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <ProfileForm
        initial={{
          firstName: profile?.firstName ?? '',
          lastName: profile?.lastName ?? '',
          email: profile?.email ?? user.email,
          consent: profile?.demographicConsent ?? false,
        }}
      />
    </main>
  );
}

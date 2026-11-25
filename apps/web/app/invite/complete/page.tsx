import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUserQuery } from '@/features/users/queries/current-user.query';
import { GeneratedEmailNotice } from '@/features/users/components/invite-forms';

export async function generateMetadata(): Promise<{ title: string; robots: { index: boolean } }> {
  const t = await getTranslations('Users.invite');
  return { title: t('metadata'), robots: { index: false } };
}

export default async function InviteCompletePage(): Promise<React.JSX.Element> {
  const user = await getCurrentUserQuery();
  if (!user?.email) redirect('/login');
  const t = await getTranslations('Users.invite');

  return (
    <div className="flex min-h-svh flex-col gap-4 p-6 md:p-10">
      <Link href="/" className="font-semibold">
        {t('platform')}
      </Link>
      <main className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-sm">
          <GeneratedEmailNotice email={user.email} succeeded />
        </div>
      </main>
    </div>
  );
}

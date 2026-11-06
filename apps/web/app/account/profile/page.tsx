import * as React from 'react';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUserQuery } from '@/features/users/queries/current-user.query';
import { getStoreViewerQuery } from '@/features/store/queries/store-viewer.query';
import { BuyerShell } from '@/features/store-directory/components/buyer-shell';
import { ProfileContent } from '@/features/users/components/profile-content';

export async function generateMetadata(): Promise<{ title: string }> {
  const t = await getTranslations('Profile');
  return { title: t('metadata') };
}

/** Buyer-area profile: same shell and rhythm as the stores and purchases pages. */
export default async function ProfilePage(): Promise<React.JSX.Element> {
  const user = await getCurrentUserQuery();
  if (!user) redirect('/login?redirectTo=%2Faccount%2Fprofile');
  const viewer = await getStoreViewerQuery();
  return (
    <BuyerShell active="profile" viewer={viewer}>
      <ProfileContent userId={user.id} email={user.email} />
    </BuyerShell>
  );
}

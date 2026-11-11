import * as React from 'react';
import { getTranslations } from 'next-intl/server';
import { getOwnProfileReadRepository } from '@/features/users/di/users.di';
import { WholesaleAccount } from '@/features/users/components/wholesale-account';
import { ProfileForm } from '@/features/users/components/profile-form';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

function initialsOf(first: string, last: string, email: string): string {
  const letters = `${first.trim().charAt(0)}${last.trim().charAt(0)}`;
  return (letters || email.trim().charAt(0) || '?').toLocaleUpperCase();
}

/**
 * Profile body shared by the dashboard (`/dashboard/profile`) and the buyer area
 * (`/account/profile`). Each route wraps it in its own shell so the page matches its context.
 */
export async function ProfileContent({
  userId,
  email,
  buyer = false,
}: {
  userId: string;
  email: string;
  buyer?: boolean;
}): Promise<React.JSX.Element> {
  const [t, profile] = await Promise.all([
    getTranslations('Profile'),
    getOwnProfileReadRepository().findForUser(userId),
  ]);
  const firstName = profile?.firstName ?? '';
  const lastName = profile?.lastName ?? '';
  const shownEmail = profile?.email ?? email;
  const fullName = `${firstName} ${lastName}`.trim();
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header className="flex items-center gap-4">
        <Avatar className="size-16 text-lg" aria-hidden="true">
          <AvatarFallback>{initialsOf(firstName, lastName, shownEmail)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 space-y-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-[2rem]">
            {fullName || t('title')}
          </h1>
          <p className="truncate text-sm text-muted-foreground">{shownEmail}</p>
        </div>
      </header>
      <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">{t('subtitle')}</p>
      {buyer && <WholesaleAccount enabled={profile?.wholesaleEnabled ?? false} />}
      <ProfileForm
        initial={{
          firstName,
          lastName,
          email: shownEmail,
          consent: profile?.demographicConsent ?? false,
        }}
      />
    </div>
  );
}

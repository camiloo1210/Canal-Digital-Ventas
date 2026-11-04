import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  AGE_RANGES,
  GENDERS,
  PROVINCES,
  isGeneratedStaffEmailOf,
  type InvitationPreviewReadModel,
} from '@canaldigital/packages/core';
import {
  getBusinessAccountReadRepository,
  getGetInvitationPreviewUseCase,
} from '@/features/users/di/users.di';
import { getCurrentUserQuery, type CurrentUser } from '@/features/users/queries/current-user.query';
import {
  InviteExistingAccountForm,
  InviteGeneratedForm,
  InviteGoogleForm,
  InviteSignupForm,
} from '@/features/users/components/invite-forms';
import { INVITE_PAGE_ERROR_CODES, type DemographicOptions } from '@/features/users/constants';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export async function generateMetadata(): Promise<{ title: string; robots: { index: boolean } }> {
  const t = await getTranslations('Users.invite');
  // Invitation links are capability URLs: keep them out of search indexes.
  return { title: t('metadata'), robots: { index: false } };
}

/** An existing session may accept the invitation only when it fits the owner's chosen mode. */
function sessionFitsInvitation(user: CurrentUser, preview: InvitationPreviewReadModel): boolean {
  if (preview.accountMode === 'REAL_EMAIL') return true;
  if (preview.accountMode === 'GOOGLE') return user.provider === 'google';
  return isGeneratedStaffEmailOf(user.email, preview.tenantSlug);
}

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<React.JSX.Element> {
  const { token } = await params;
  const query = await searchParams;
  const t = await getTranslations('Users.invite');
  const [preview, user] = await Promise.all([
    getGetInvitationPreviewUseCase().execute(token),
    getCurrentUserQuery(),
  ]);
  // A signed-in business account of ANOTHER company can never accept: no form, just the reason.
  const boundElsewhere =
    preview && user
      ? await getBusinessAccountReadRepository().isBoundToOtherTenant(user.id, preview.tenantId)
      : false;
  const options: DemographicOptions = {
    ageRanges: AGE_RANGES,
    genders: GENDERS,
    provinces: PROVINCES,
  };
  // Only known codes are rendered, never arbitrary query text.
  const errorCode = typeof query.error === 'string' ? query.error : null;
  const errorMessage =
    errorCode && INVITE_PAGE_ERROR_CODES.includes(errorCode) ? t(`errors.${errorCode}`) : null;

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link href="/" className="flex items-center gap-2 font-medium">
            <Image src="/Logo.svg" alt="" width={24} height={24} />
            <span className="font-semibold text-lg">{t('platform')}</span>
          </Link>
        </div>
        <main className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            {preview ? (
              <div className="flex flex-col gap-6">
                <div className="flex flex-col items-center gap-1 text-center">
                  <h1 className="text-2xl font-bold">
                    {t('title', { store: preview.tenantName })}
                  </h1>
                  <p className="text-muted-foreground text-sm text-balance">
                    {t(`description.${preview.accountMode}`, { role: preview.roleName })}
                  </p>
                </div>
                {errorMessage && (
                  <Alert variant="destructive" role="alert">
                    <AlertDescription>{errorMessage}</AlertDescription>
                  </Alert>
                )}
                {boundElsewhere ? (
                  <div className="flex flex-col gap-4 text-center">
                    <Alert variant="destructive" role="alert">
                      <AlertDescription>{t('errors.businessAccountBound')}</AlertDescription>
                    </Alert>
                    <Button nativeButton={false} render={<Link href="/" />} className="min-h-11">
                      {t('backHome')}
                    </Button>
                  </div>
                ) : user && sessionFitsInvitation(user, preview) ? (
                  <InviteExistingAccountForm token={token} email={user.email} options={options} />
                ) : preview.accountMode === 'GENERATED_EMAIL' ? (
                  <InviteGeneratedForm token={token} options={options} />
                ) : preview.accountMode === 'REAL_EMAIL' ? (
                  <InviteSignupForm token={token} options={options} />
                ) : (
                  <InviteGoogleForm token={token} options={options} />
                )}
              </div>
            ) : (
              <div role="alert" className="flex flex-col gap-4 text-center">
                <h1 className="text-2xl font-bold">{t('invalidTitle')}</h1>
                <p className="text-muted-foreground text-sm">{t('invalidBody')}</p>
                <Button nativeButton={false} render={<Link href="/" />} className="min-h-11">
                  {t('backHome')}
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>
      <div className="bg-muted relative hidden lg:flex items-center justify-center sticky top-0 h-svh">
        <Image src="/Logo.svg" alt="" width={400} height={400} className="object-contain" />
      </div>
    </div>
  );
}

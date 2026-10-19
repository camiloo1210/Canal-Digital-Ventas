import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import { LoginForm } from '@/features/iam/ui/components/login-form';
import { safeAuthReturnPath } from '@/features/iam/utils/auth-return-path';

export default async function LoginPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<React.JSX.Element> {
  const searchParams = await props.searchParams;
  const t = await getTranslations('Storefront.auth');
  const message =
    searchParams.error || searchParams.message
      ? t('errors.oauth')
      : searchParams.notice === 'confirmEmail'
        ? t('confirmEmail')
        : undefined;

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a
            href={safeAuthReturnPath(searchParams.redirectTo)}
            className="flex items-center gap-2 font-medium"
          >
            <Image src="/Logo.svg" alt={t('logo')} width={24} height={24} />
            <span className="font-semibold text-lg">{t('platform')}</span>
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginForm
              message={message}
              redirectTo={
                searchParams.redirectTo ? safeAuthReturnPath(searchParams.redirectTo) : undefined
              }
            />
          </div>
        </div>
      </div>
      <div className="bg-muted relative hidden lg:flex items-center justify-center sticky top-0 h-svh">
        <Image
          src="/Logo.svg"
          alt={t('logo')}
          width={400}
          height={400}
          className="object-contain"
        />
      </div>
    </div>
  );
}

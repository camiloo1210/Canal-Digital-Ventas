import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import { SignupCustomerForm } from '@/features/iam/ui/components/signup-customer-form';
import { safeAuthReturnPath } from '@/features/iam/utils/auth-return-path';

export async function generateMetadata(): Promise<{ title: string }> {
  const t = await getTranslations('Storefront.auth');
  return { title: `${t('signupTitle')} | ${t('platform')}` };
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const params = await searchParams;
  const t = await getTranslations('Storefront.auth');
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a
            href={safeAuthReturnPath(params.redirectTo)}
            className="flex items-center gap-2 font-medium"
          >
            <Image src="/Logo.svg" alt={t('logo')} width={24} height={24} />
            <span className="font-semibold text-lg">{t('platform')}</span>
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <SignupCustomerForm redirectTo={safeAuthReturnPath(params.redirectTo)} />
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

import { OnboardingForm } from '@/features/iam/ui/components/onboarding-form';
import { getTranslations } from 'next-intl/server';
import { getBusinessAccountReadRepository } from '@/features/iam/di/business-account.di';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Image from 'next/image';

export const metadata = {
  title: 'Onboarding | Canal Digital',
};

export default async function OnboardingPage(): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If there's no user, the proxy should have redirected them to /login,
  // but we double-check here just in case.
  if (!user) {
    redirect('/login');
  }

  // Business accounts belong to one company and can never create another: no form for them.
  const isBusinessAccount = await getBusinessAccountReadRepository().isBusinessAccount(user.id);
  const t = await getTranslations('Users.errors');

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="#" className="flex items-center gap-2 font-medium">
            <Image src="/Logo.svg" alt="Canal Digital Logo" width={24} height={24} />
            <span className="font-semibold text-lg">Canal Digital</span>
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            <div className="flex flex-col space-y-2 text-center mb-6">
              <h1 className="text-2xl font-semibold tracking-tight">
                Termine de configurar su tienda
              </h1>
              <p className="text-sm text-muted-foreground">
                Solo toma un minuto dejar todo listo para empezar a vender.
              </p>
            </div>
            {isBusinessAccount ? (
              <div
                role="alert"
                className="bg-destructive/15 text-destructive border border-destructive/50 p-3 rounded-md text-sm font-medium"
              >
                {t('businessAccountBound')}
              </div>
            ) : (
              <OnboardingForm />
            )}
          </div>
        </div>
      </div>
      <div className="bg-muted relative hidden lg:flex items-center justify-center sticky top-0 h-svh">
        <Image
          src="/Logo.svg"
          alt="Canal Digital Logo"
          width={400}
          height={400}
          className="object-contain"
        />
      </div>
    </div>
  );
}

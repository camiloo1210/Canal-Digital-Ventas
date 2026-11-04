import Image from 'next/image';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import {
  defaultTenantFor,
  getDashboardContextQuery,
} from '@/features/dashboard/queries/dashboard-context.query';
import {
  BusinessPicker,
  type BusinessPickerItem,
} from '@/features/dashboard/components/business-picker';
import { LogoutForm } from '@/features/iam/components/logout-form';
import { Button } from '@/components/ui/button';

export async function generateMetadata(): Promise<{ title: string }> {
  const t = await getTranslations('BusinessSwitcher');
  return { title: t('metadata') };
}

export default async function SelectBusinessPage(): Promise<React.JSX.Element> {
  const [context, t] = await Promise.all([
    getDashboardContextQuery(),
    getTranslations('BusinessSwitcher'),
  ]);
  if (context.memberships.length === 0) redirect('/onboarding');
  // One business needs no choice.
  if (context.memberships.length === 1) redirect('/dashboard');
  const last = await defaultTenantFor(context.memberships);
  const businesses = context.memberships.map((membership): BusinessPickerItem => ({
    tenantId: membership.tenantId,
    tenantName: membership.tenantName,
    tenantSlug: membership.tenantSlug,
    role: membership.role,
  }));
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <span className="flex items-center gap-2 font-medium">
            <Image src="/Logo.svg" alt="" width={24} height={24} />
            <span className="text-lg font-semibold">Canal Digital</span>
          </span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-md">
            <div className="mb-6 flex flex-col space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">{t('pageTitle')}</h1>
              <p className="text-sm text-muted-foreground">{t('pageDescription')}</p>
            </div>
            <BusinessPicker businesses={businesses} lastTenantId={last?.tenantId ?? null} />
            <div className="mt-6 flex justify-center">
              <LogoutForm>
                <Button variant="ghost" type="submit" className="min-h-11">
                  {t('logout')}
                </Button>
              </LogoutForm>
            </div>
          </div>
        </div>
      </div>
      <div className="sticky top-0 hidden h-svh items-center justify-center bg-muted lg:flex">
        <Image src="/Logo.svg" alt="" width={400} height={400} className="object-contain" />
      </div>
    </div>
  );
}

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { getDashboardContextQuery } from '@/features/dashboard/queries/dashboard-context.query';
import { logoutAction } from '@/features/iam/actions/logout.action';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const context = await getDashboardContextQuery();
  const t = await getTranslations('AdminShell');
  if (context.tenant.status === 'none') redirect('/onboarding');
  if (context.tenant.status !== 'ready')
    return (
      <main className="mx-auto w-full max-w-xl space-y-6 px-4 py-16">
        <h1 className="text-2xl font-semibold">{t('contextTitle')}</h1>
        <Alert>
          <AlertTitle>{t('multipleTitle')}</AlertTitle>
          <AlertDescription>{t('multipleDescription')}</AlertDescription>
        </Alert>
        <div className="flex flex-wrap gap-3">
          <Button nativeButton={false} render={<Link href="/" />}>
            {t('backToStores')}
          </Button>
          <form action={logoutAction}>
            <Button variant="outline" type="submit">
              {t('logout')}
            </Button>
          </form>
        </div>
      </main>
    );
  return (
    <div className="admin-space min-h-svh">
      <Link
        href="#dashboard-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-4 focus:py-3 focus:text-primary-foreground"
      >
        {t('skip')}
      </Link>
      <SidebarProvider
        style={{ '--sidebar-width': '16rem', '--header-height': '3.5rem' } as React.CSSProperties}
      >
        <AppSidebar
          variant="inset"
          user={{
            name: context.name || t('account'),
            email: context.email,
            avatar: context.avatar,
            tenantName: context.tenant.tenantName,
            tenantSlug: context.tenant.tenantSlug,
          }}
        />
        <SidebarInset
          id="dashboard-main"
          tabIndex={-1}
          className="min-w-0 scroll-mt-16 focus:outline-none"
        >
          {children}
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}

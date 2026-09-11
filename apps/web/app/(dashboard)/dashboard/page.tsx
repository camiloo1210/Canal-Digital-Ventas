import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AppSidebar } from '@/components/app-sidebar';
import { ChartAreaInteractive } from '@/components/chart-area-interactive';
import { DataTable } from '@/components/data-table';
import { SectionCards } from '@/components/section-cards';
import { SiteHeader } from '@/components/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

import { CreateCategoryForm } from '@/features/dashboard/ui/components/create-category-form';

import data from './data.json';

export default async function DashboardPage(): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  const userData = {
    name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Administrator',
    email: user.email || '',
    role: user.user_metadata?.role || 'Admin',
    tenantName: user.user_metadata?.tenant_name || 'Canal Digital',
    avatar: user.user_metadata?.avatar_url || '',
  };

  // CQRS-lite: Directly query the repositories for the dashboard view
  // const categoryRepo = await getCategoryRepository()
  // const productRepo = await getProductRepository()

  // In a real scenario, you'd fetch actual metrics:
  // const totalCategories = await categoryRepo.count(...)
  // const totalProducts = await productRepo.count(...)

  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 72)',
          '--header-height': 'calc(var(--spacing) * 12)',
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" user={userData} />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <SectionCards />

              <div className="px-4 lg:px-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <ChartAreaInteractive />
                </div>

                {/* Dashboard Mutation Form (Quick Action) */}
                <Card className="flex flex-col h-full">
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                    <CardDescription>
                      Create a new category directly from the dashboard.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <CreateCategoryForm />
                  </CardContent>
                </Card>
              </div>

              <DataTable data={data} />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

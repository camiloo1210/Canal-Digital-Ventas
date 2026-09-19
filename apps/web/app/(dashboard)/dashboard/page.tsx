import { ChartAreaInteractive } from '@/components/chart-area-interactive';
import { DataTable } from '@/components/data-table';
import { SectionCards } from '@/components/section-cards';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { CreateCategoryForm } from '@/features/dashboard/ui/components/create-category-form';
import data from '@/app/(dashboard)/dashboard/data.json';

export default async function DashboardPage(): Promise<React.JSX.Element> {
  // CQRS-lite: Directly query the repositories for the dashboard view
  // const categoryRepo = await getCategoryRepository()
  // const productRepo = await getProductRepository()

  return (
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
  );
}

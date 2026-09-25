import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { logoutAction } from '@/features/iam/actions/logout.action';
import { LogOut } from 'lucide-react';
import { listActiveTenantsQuery } from '@/features/iam/queries/list-active-tenants.query';
import { StoreDirectory } from '@/features/store-directory/components/store-directory';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export const metadata = {
  title: 'My Purchases | Canal Digital',
};

export default async function BuyerDashboardPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const page = searchParams.page ? parseInt(searchParams.page as string, 10) : 1;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const activeTenantsResult = await listActiveTenantsQuery(page, 24);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-xl font-bold text-foreground">Buyer Dashboard</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground hidden sm:inline-block">{user.email}</span>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md p-1"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12 w-full">
        {/* Active Businesses Directory */}
        <StoreDirectory 
          result={activeTenantsResult} 
          labels={{
            title: "Available Stores",
            empty: "No stores are available at the moment.",
            visit: "Visit Storefront"
          }} 
        />

        {/* Recent Purchases */}
        <section>
          <Card className="shadow-sm border-border">
            <CardHeader className="border-b border-border bg-muted/20">
              <CardTitle className="text-lg text-foreground">Recent Purchases</CardTitle>
              <CardDescription>
                Here you can see all orders placed across any tenant store.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-12 text-center text-muted-foreground">
              You haven't made any purchases yet.
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

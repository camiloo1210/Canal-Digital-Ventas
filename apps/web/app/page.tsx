import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { logoutAction } from '@/features/iam/actions/logout.action';
import { LogOut, Store } from 'lucide-react';
import { listActiveTenantsQuery } from '@/features/iam/queries/list-active-tenants.query';

export const metadata = {
  title: 'My Purchases | Canal Digital',
};

export default async function BuyerDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const activeTenants = await listActiveTenantsQuery();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-xl font-bold text-gray-900">Buyer Dashboard</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">{user.email}</span>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="text-gray-500 hover:text-gray-900 flex items-center gap-2 text-sm font-medium"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        {/* Active Businesses Directory */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <Store className="w-6 h-6 text-indigo-600" />
            <h2 className="text-2xl font-bold text-gray-900">Available Stores</h2>
          </div>
          
          {activeTenants.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center text-gray-500">
              No stores are available at the moment.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {activeTenants.map((tenant) => (
                <Link
                  key={tenant.id}
                  href={`/store/${tenant.slug}`}
                  className="group bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow flex flex-col items-center text-center h-48 justify-center"
                >
                  <div className="w-16 h-16 bg-gray-100 rounded-full mb-4 group-hover:bg-indigo-50 transition-colors flex items-center justify-center">
                    <Store className="w-8 h-8 text-gray-400 group-hover:text-indigo-600 transition-colors" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                    {tenant.name}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">Visit Storefront &rarr;</p>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Recent Purchases */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Purchases</h2>
            <p className="text-sm text-gray-500 mt-1">
              Here you can see all orders placed across any tenant store.
            </p>
          </div>

          <div className="p-6 text-center text-gray-500 py-12">
            You haven't made any purchases yet.
          </div>
        </section>
      </main>
    </div>
  );
}

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { logoutAction } from '@/features/iam/actions/logout.action';
import { LogOut } from 'lucide-react';

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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Purchases</h2>
            <p className="text-sm text-gray-500 mt-1">
              Here you can see all orders placed across any tenant store.
            </p>
          </div>

          <div className="p-6 text-center text-gray-500 py-12">
            You haven't made any purchases yet.
            <div className="mt-4">
              <Link
                href="/store/demo-store"
                className="text-indigo-600 font-medium hover:underline"
              >
                Visit Demo Store
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

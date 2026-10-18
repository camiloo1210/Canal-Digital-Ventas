import { ReactNode } from 'react';
import Link from 'next/link';

export default async function StoreLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const resolvedParams = await params;
  return (
    <div className="min-h-screen bg-white">
      {/* 
        This is a very simple dummy header for the storefront.
        In a real scenario, this would query the Tenant entity to display the real store name, logo, etc.
      */}
      <header className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex-shrink-0 flex items-center">
              <Link
                href={`/store/${resolvedParams.tenantSlug}`}
                className="text-xl font-bold text-gray-900"
              >
                {resolvedParams.tenantSlug} Store
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href={`/client/signup?tenantSlug=${resolvedParams.tenantSlug}`}
                className="text-sm font-medium text-gray-700 hover:text-indigo-600"
              >
                Create Account
              </Link>
              <Link
                href="/login"
                className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-md"
              >
                Log In
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}

import { getProductRepository } from '@/features/products/di/products.di';
import { Product } from '@canaldigital/packages/core';
import { createTenantId } from '@canaldigital/packages/core/src/features/shared/domain/types/tenant-id.type';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import Image from 'next/image';
// import { createTenantId } from '@canaldigital/packages/core/src/features/shared/domain/types/tenant-id.type'; // Using hardcoded string since the core repository might expect a string or TenantId

export const metadata = {
  title: 'Products | Canal Digital',
};

// Force dynamic rendering to ensure fresh data from DB on every request (useful since this is an MVP without complex caching)
export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  const repository = await getProductRepository();
  // Mock tenantId for now (same as used in the action)
  const tenantId = createTenantId('11111111-1111-1111-1111-111111111111');

  // Usamos el repositorio directamente para lecturas rápidas (RSC).
  // Next.js App Router recomienda usar Server Components para reads directos.
  const result = await repository.findAll(tenantId, { limit: 50, page: 1 });
  const products = result.items;

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">
            Products
          </h1>
          <Link
            href="/products/new"
            className="bg-indigo-600 hover:bg-indigo-700 px-6 py-3 rounded-lg font-medium transition-all shadow-[0_0_15px_rgba(79,70,229,0.4)]"
          >
            + New Product
          </Link>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-20 text-gray-500 border border-dashed border-gray-800 rounded-2xl">
            <p className="text-xl">No products found in the catalog.</p>
            <p className="text-sm mt-2">Click &quot;+ New Product&quot; to add your first item.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product: Product) => (
              <Card
                key={product.getId()}
                className="bg-white/5 border-white/10 overflow-hidden hover:bg-white/10 transition-colors shadow-xl"
              >
                <div className="aspect-square relative bg-black/40 border-b border-white/5">
                  {product.getImageUrl() ? (
                    <Image
                      src={product.getImageUrl()!}
                      alt={product.getName()}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600">
                      No Image
                    </div>
                  )}
                </div>
                <CardHeader>
                  <CardTitle className="text-lg text-white font-bold">
                    {product.getName()}
                  </CardTitle>
                  <p className="text-sm text-gray-400 font-mono">{product.getSku()}</p>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-indigo-400">
                    ${(product.getPrice().getValue() / 100).toFixed(2)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

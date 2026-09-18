import { getProductRepository } from '@/features/products/di/products.di';
import { Product } from '@canaldigital/packages/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import Image from 'next/image';
import { formatMoney } from '@/lib/money';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getActiveTenantQuery } from '@/features/iam/queries/active-tenant.query';
import { getTranslations } from 'next-intl/server';

export const metadata = {
  title: 'Products | Canal Digital',
};

// Force dynamic rendering to ensure fresh data from DB on every request (useful since this is an MVP without complex caching)
export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect is preserved here momentarily in case of direct deep linkage before layout renders
  if (!user) {
    redirect('/login');
  }

  const tenantId = await getActiveTenantQuery(user.id);

  if (!tenantId) {
    redirect('/onboarding');
  }

  const t = await getTranslations('Products');

  const repository = await getProductRepository();
  // Todo(Performance): Evaluar EXPLAIN ANALYZE en el índice (tenant_id, status, created_at DESC)
  // antes de migrar limit/offset a keyset cursor pagination para esta consulta.
  const result = await repository.findAll(tenantId, { limit: 50, page: 1 });
  const products = result.items;

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold tracking-tight">{t('list_title')}</h1>
            <Link
              href="/dashboard/catalog/products/new"
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm"
            >
              {t('new_product_button')}
            </Link>
          </div>

          {products.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground border border-dashed rounded-xl">
              <p className="text-xl font-medium">{t('empty_state_title')}</p>
              <p className="text-sm mt-2">{t('empty_state_desc')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((product: Product) => (
                <Card
                  key={product.getId()}
                  className="overflow-hidden hover:bg-accent/50 transition-colors shadow-sm"
                >
                  <div className="aspect-square relative bg-muted border-b">
                    {product.getImageUrl() ? (
                      <Image
                        src={product.getImageUrl()!}
                        alt={product.getName()}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        {t('no_image')}
                      </div>
                    )}
                  </div>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-lg font-bold line-clamp-1">
                      {product.getName()}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground font-mono">{product.getSku()}</p>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-xl font-bold text-primary">
                      {formatMoney(product.getPrice().getValue())}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

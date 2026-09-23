import { getCategoryReadRepository } from '@/features/categories/di/categories.di';
import { CategoryCardActions } from '@/features/categories/components/category-card-actions';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getActiveTenantQuery } from '@/features/iam/queries/active-tenant.query';
import { CategoryReadModel } from '@canaldigital/packages/core';

export const metadata = {
  title: 'Categories | Canal Digital',
};

// Force dynamic rendering to ensure fresh data from DB on every request
export const dynamic = 'force-dynamic';

import { PageHeader } from '@/components/page-header';

import { getTranslations } from 'next-intl/server';

export default async function CategoriesPage(): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const tenantId = await getActiveTenantQuery(user.id);

  if (!tenantId) {
    redirect('/onboarding');
  }

  const repository = await getCategoryReadRepository();
  const result = await repository.findAll(tenantId, { limit: 50, page: 1 });
  const categories = result.items;

  const t = await getTranslations('Categories');

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <PageHeader breadcrumbs={[{ label: t('list_title'), href: null }]} />
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold tracking-tight">{t('list_title')}</h1>
            <Link
              href="/dashboard/catalog/categories/new"
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm"
            >
              {t('new_category_button')}
            </Link>
          </div>

          {categories.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground border border-dashed rounded-xl">
              <p className="text-xl font-medium">{t('empty_state_title')}</p>
              <p className="text-sm mt-2">{t('empty_state_desc')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {categories.map((category: CategoryReadModel) => (
                <Card
                  key={category.id}
                  className={`overflow-hidden transition-colors shadow-sm relative ${
                    category.status === 'archived' 
                      ? 'opacity-75 grayscale-[0.5] hover:bg-transparent' 
                      : 'hover:bg-accent/50'
                  }`}
                >
                  <CardHeader className="p-4 pb-2 relative">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        <CardTitle className="text-lg font-bold line-clamp-1">
                          {category.name}
                        </CardTitle>
                        <div className="mt-2">
                          {category.status === 'archived' ? (
                            <Badge variant="secondary" className="border-destructive/20 text-destructive text-[10px]">
                              {t('status_archived')}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-500/20 bg-emerald-500/10 text-[10px]">
                              {t('status_active')}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <CategoryCardActions category={category} />
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {category.description || 'No description provided.'}
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

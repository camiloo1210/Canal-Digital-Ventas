import { getCategoryReadRepository } from '@/features/categories/di/categories.di';
import { EditCategoryForm } from '@/features/categories/components/edit-category-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveTenantQuery } from '@/features/iam/queries/active-tenant.query';

export const metadata = {
  title: 'Edit Category | Canal Digital',
};

import { PageHeader } from '@/components/page-header';

import { getTranslations } from 'next-intl/server';

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  
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
  const category = await repository.findById(id, tenantId);

  if (!category) {
    notFound();
  }

  const t = await getTranslations('Categories');

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <PageHeader breadcrumbs={[{ label: t('list_title'), href: '/dashboard/catalog/categories' }, { label: category.name, href: null }, { label: t('action_edit'), href: null }]} />
        <div className="flex flex-1 flex-col items-center py-6 md:py-10 px-4 lg:px-6">
          <div className="w-full max-w-2xl">
            <h1 className="text-3xl font-bold tracking-tight mb-8">{t('edit_title')}</h1>
            
            <Card>
              <CardContent className="pt-6">
                <EditCategoryForm initialData={category} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

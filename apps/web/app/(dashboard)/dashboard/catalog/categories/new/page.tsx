import { CreateCategoryForm } from '@/features/categories/components/create-category-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Add Category | Canal Digital',
};

import { PageHeader } from '@/components/page-header';

import { getTranslations } from 'next-intl/server';

export default async function NewCategoryPage(): Promise<React.JSX.Element> {
  const t = await getTranslations('Categories');

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <PageHeader breadcrumbs={[{ label: t('list_title'), href: '/dashboard/catalog/categories' }, { label: t('new_title'), href: null }]} />
        <div className="flex flex-1 flex-col items-center py-6 md:py-10 px-4 lg:px-6">
          <div className="w-full max-w-2xl">
            <h1 className="text-3xl font-bold tracking-tight mb-8">{t('new_title')}</h1>
            
            <Card>
              <CardContent className="pt-6">
                <CreateCategoryForm />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

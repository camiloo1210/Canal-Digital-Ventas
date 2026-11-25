import Form from 'next/form';
import { TenantLink as Link, TenantParamField } from '@/features/dashboard/components/tenant-scope';
import { getTranslations } from 'next-intl/server';
import type { AdminCatalogCategoryOption, AdminCatalogQuery } from '@canaldigital/packages/core';
import type { CatalogKind } from '@/features/dashboard/queries/catalog-query';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { CatalogSearchButton } from '@/features/dashboard/components/catalog-search-button';

export async function CatalogToolbar({
  kind,
  query,
  categoryOptions,
}: {
  kind: CatalogKind;
  query: AdminCatalogQuery;
  categoryOptions: readonly AdminCatalogCategoryOption[] | null;
}): Promise<React.JSX.Element> {
  const t = await getTranslations('AdminCatalog');
  const statuses =
    kind === 'products'
      ? (['all', 'active', 'inactive', 'out_of_stock', 'archived'] as const)
      : (['all', 'active', 'inactive', 'archived'] as const);
  const selectedCategory = query.categoryId ?? '';
  const categories = [
    { value: '', label: t('allCategories') },
    ...(categoryOptions ?? []).map((category): { value: string; label: string } => ({
      value: category.id,
      label: category.name,
    })),
  ];
  if (selectedCategory && !categories.some((item): boolean => item.value === selectedCategory))
    categories.push({ value: selectedCategory, label: t('selectedCategoryUnavailable') });
  return (
    <Form
      action={'/dashboard/catalog/' + kind}
      role="search"
      aria-label={t(kind === 'products' ? 'searchProducts' : 'searchCategories')}
      className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4 shadow-(--shadow-card)"
      key={JSON.stringify([query.q, query.status, selectedCategory])}
    >
      <TenantParamField />
      <div className="min-w-0 grow basis-64 space-y-2">
        <Label htmlFor="catalog-search">
          {t(kind === 'products' ? 'searchProducts' : 'searchCategories')}
        </Label>
        <Input
          id="catalog-search"
          type="search"
          name="q"
          defaultValue={query.q}
          maxLength={200}
          className="min-h-11"
          placeholder={t(
            kind === 'products' ? 'searchProductPlaceholder' : 'searchCategoryPlaceholder',
          )}
        />
      </div>
      {kind === 'products' && (
        <div className="w-full min-w-0 space-y-2 sm:w-56">
          <Label htmlFor="catalog-category">{t('category')}</Label>
          <Select name="category" defaultValue={selectedCategory} items={categories}>
            <SelectTrigger id="catalog-category" className="min-h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category): React.JSX.Element => (
                <SelectItem key={category.value} value={category.value} className="min-h-11">
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="w-full space-y-2 sm:w-44">
        <Label htmlFor="catalog-status">{t('status')}</Label>
        <Select
          name="status"
          defaultValue={query.status}
          items={statuses.map((value): { value: string; label: string } => ({
            value,
            label: t(value),
          }))}
        >
          <SelectTrigger id="catalog-status" className="min-h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((status): React.JSX.Element => (
              <SelectItem key={status} value={status}>
                {t(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <CatalogSearchButton label={t('apply')} pendingLabel={t('searching')} />
      {(query.q || query.status !== 'all' || selectedCategory) && (
        <Link
          href={'/dashboard/catalog/' + kind}
          className="inline-flex min-h-11 items-center px-2 text-sm font-medium underline-offset-4 hover:underline"
        >
          {t('clear')}
        </Link>
      )}
      {kind === 'products' && categoryOptions === null && (
        <p role="status" className="basis-full text-sm text-muted-foreground">
          {t('categoryOptionsUnavailable')}
        </p>
      )}
    </Form>
  );
}

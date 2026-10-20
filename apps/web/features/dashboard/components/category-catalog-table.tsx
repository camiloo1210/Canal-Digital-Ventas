import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import type { AdminCategoryCatalogItem } from '@canaldigital/packages/core';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { CatalogStatusBadge } from '@/features/dashboard/components/catalog-status-badge';
import { CategoryCardActions } from '@/features/categories/components/category-card-actions';

export async function CategoryCatalogTable({
  items,
}: {
  items: AdminCategoryCatalogItem[];
}): Promise<React.JSX.Element> {
  const [t, locale] = await Promise.all([getTranslations('AdminCatalog'), getLocale()]);
  const number = new Intl.NumberFormat(locale);
  const editHref = (id: string): string => '/dashboard/catalog/categories/' + id + '/edit';
  return (
    <>
      <div className="hidden lg:block">
        <Table className="table-fixed">
          <caption className="sr-only">{t('categoriesTitle')}</caption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="w-[28%] pl-5">
                {t('category')}
              </TableHead>
              <TableHead scope="col" className="w-[36%]">
                {t('description')}
              </TableHead>
              <TableHead scope="col" className="w-[16%] text-right">
                {t('associatedProducts')}
              </TableHead>
              <TableHead scope="col" className="w-[14%]">
                {t('status')}
              </TableHead>
              <TableHead scope="col" className="w-16 pr-5">
                <span className="sr-only">{t('actions')}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((category): React.JSX.Element => (
              <TableRow key={category.id}>
                <TableCell className="py-4 pl-5 whitespace-normal">
                  <Link
                    href={editHref(category.id)}
                    className="inline-flex min-h-11 items-center break-words font-medium underline-offset-4 hover:underline [overflow-wrap:anywhere]"
                  >
                    {category.name}
                  </Link>
                </TableCell>
                <TableCell className="whitespace-normal break-words text-muted-foreground [overflow-wrap:anywhere]">
                  {category.description || t('noDescription')}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {number.format(category.productCount)}
                </TableCell>
                <TableCell>
                  <CatalogStatusBadge status={category.status} label={t(category.status)} />
                </TableCell>
                <TableCell className="pr-5">
                  <CategoryCardActions category={category} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="divide-y lg:hidden">
        {items.map((category): React.JSX.Element => (
          <li key={category.id} className="space-y-3 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <Link
                href={editHref(category.id)}
                className="inline-flex min-h-11 min-w-0 items-center break-words text-sm font-semibold underline-offset-4 hover:underline [overflow-wrap:anywhere]"
              >
                {category.name}
              </Link>
              <CategoryCardActions category={category} />
            </div>
            <p className="break-words text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
              {category.description || t('noDescription')}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {t('productCount', { count: category.productCount })}
              </p>
              <CatalogStatusBadge status={category.status} label={t(category.status)} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

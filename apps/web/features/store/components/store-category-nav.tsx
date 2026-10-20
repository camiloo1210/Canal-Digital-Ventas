import * as React from 'react';
import Link from 'next/link';
import { PublicCategoryReadModel } from '@canaldigital/packages/core';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface StoreCategoryNavProps {
  categories: PublicCategoryReadModel[];
  currentCategorySlug?: string;
  currentQuery?: string;
  labels: {
    categories: string;
    allProducts: string;
    noCategories: string;
  };
}

export function StoreCategoryNav({
  categories,
  currentCategorySlug,
  currentQuery,
  labels,
}: StoreCategoryNavProps): React.JSX.Element {
  const buildHref = (categorySlug?: string): string => {
    const params = new URLSearchParams();
    if (currentQuery) params.set('q', currentQuery);
    if (categorySlug) params.set('category', categorySlug);
    // Note: page is intentionally omitted (reset) to return to page 1 on category change

    const qs = params.toString();
    return qs ? `?${qs}` : '?';
  };

  return (
    <nav className="min-w-0 w-full" aria-label={labels.categories}>
      <h2 className="sr-only">{labels.categories}</h2>

      {categories.length === 0 ? (
        <p className="text-muted-foreground text-sm">{labels.noCategories}</p>
      ) : (
        <ul className="-m-1 flex items-center gap-2 overflow-x-auto overscroll-x-contain p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <li className="flex-shrink-0">
            <Link
              href={buildHref()}
              scroll={false}
              aria-current={!currentCategorySlug ? 'page' : undefined}
              className={cn(
                buttonVariants({ variant: !currentCategorySlug ? 'default' : 'outline' }),
                'min-h-11 rounded-full px-4',
              )}
            >
              {labels.allProducts}
            </Link>
          </li>

          {categories.map((category): React.JSX.Element => {
            const isActive = category.slug === currentCategorySlug;

            return (
              <li key={category.slug} className="flex-shrink-0">
                <Link
                  href={buildHref(isActive ? undefined : category.slug)}
                  scroll={false}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    buttonVariants({ variant: isActive ? 'default' : 'outline' }),
                    'min-h-11 rounded-full px-4',
                  )}
                >
                  {category.name}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}

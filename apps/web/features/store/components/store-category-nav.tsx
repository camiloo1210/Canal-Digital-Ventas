import * as React from 'react';
import Link from 'next/link';
import { PublicCategoryReadModel } from '@canaldigital/packages/core';

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
  const buildHref = (categorySlug?: string) => {
    const params = new URLSearchParams();
    if (currentQuery) params.set('q', currentQuery);
    if (categorySlug) params.set('category', categorySlug);
    // Note: page is intentionally omitted (reset) to return to page 1 on category change

    const qs = params.toString();
    return qs ? `?${qs}` : '?';
  };

  return (
    <nav className="w-full mb-6" aria-label={labels.categories}>
      <h2 className="sr-only">{labels.categories}</h2>

      {categories.length === 0 ? (
        <p className="text-muted-foreground text-sm">{labels.noCategories}</p>
      ) : (
        <ul className="flex items-center gap-2 overflow-x-auto pb-2">
          <li className="flex-shrink-0">
            <Link
              href={buildHref()}
              scroll={false}
              aria-current={!currentCategorySlug ? 'page' : undefined}
              className={`block px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                !currentCategorySlug
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground border-input hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              {labels.allProducts}
            </Link>
          </li>

          {categories.map((category) => {
            const isActive = category.slug === currentCategorySlug;

            return (
              <li key={category.slug} className="flex-shrink-0">
                <Link
                  href={buildHref(isActive ? undefined : category.slug)}
                  scroll={false}
                  aria-current={isActive ? 'page' : undefined}
                  className={`block px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-foreground border-input hover:bg-accent hover:text-accent-foreground'
                  }`}
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

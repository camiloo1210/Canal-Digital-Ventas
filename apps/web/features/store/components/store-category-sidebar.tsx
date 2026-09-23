import * as React from "react";
import Link from 'next/link';
import { PublicCategoryReadModel } from '@canaldigital/packages/core';

interface StoreCategorySidebarProps {
  categories: PublicCategoryReadModel[];
  currentCategorySlug?: string;
  labels: {
    categories: string;
    allProducts: string;
    noCategories: string;
  };
}

export function StoreCategorySidebar({ categories, currentCategorySlug, labels }: StoreCategorySidebarProps): React.JSX.Element {
  return (
    <nav className="w-full sm:w-64 flex-shrink-0" aria-label={labels.categories}>
      <h2 className="text-lg font-semibold text-foreground mb-4">{labels.categories}</h2>
      
      {categories.length === 0 ? (
        <p className="text-muted-foreground text-sm">{labels.noCategories}</p>
      ) : (
        <ul className="space-y-1">
          <li>
            <Link
              href="?"
              aria-current={!currentCategorySlug ? 'page' : undefined}
              className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                !currentCategorySlug
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              {labels.allProducts}
            </Link>
          </li>
          
          {categories.map((category) => {
            const isActive = category.slug === currentCategorySlug;
            
            return (
              <li key={category.slug}>
                <Link
                  href={`?category=${category.slug}`}
                  aria-current={isActive ? 'page' : undefined}
                  className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
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

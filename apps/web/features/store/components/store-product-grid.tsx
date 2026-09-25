import * as React from "react";
import { PublicProductReadModel } from '@canaldigital/packages/core';
import { formatMoney } from '@/lib/money';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';

interface StoreProductGridProps {
  products: PublicProductReadModel[];
  currentPage: number;
  totalPages: number;
  pageInfoTemplate: string;
}

export function StoreProductGrid({ products, currentPage, totalPages, pageInfoTemplate }: StoreProductGridProps): React.JSX.Element {
  if (products.length === 0) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-24 text-center border border-dashed rounded-xl border-border bg-card">
        <h3 className="text-xl font-semibold text-foreground mb-2">No products found</h3>
        <p className="text-muted-foreground">Try adjusting your category or search filters.</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {products.map((product) => (
          <Card
            key={product.id}
            className="group flex flex-col overflow-hidden transition-shadow shadow-sm hover:shadow-md"
          >
            <div className="aspect-[4/3] relative bg-muted border-b">
              {product.imageUrl ? (
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full text-muted-foreground">
                  <span>No image</span>
                </div>
              )}
            </div>

            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-medium line-clamp-2" title={product.name}>
                {product.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 flex flex-col flex-grow">
              <div className="mt-auto pt-4 flex items-center justify-between">
                <span className="text-lg font-bold text-foreground">
                  {formatMoney(product.priceCents)}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-12 flex items-center justify-center space-x-2">
          {/* A proper pagination component should go here. For now, simple text. */}
          <span className="text-sm text-muted-foreground">
            {pageInfoTemplate.replace('{current}', String(currentPage)).replace('{total}', String(totalPages))}
          </span>
        </div>
      )}
    </div>
  );
}

'use client';

import { ProductForm } from '@/features/products/components/product-form';
import type { CategoryOption } from '@/features/products/components/product-form-fields';
import type { ProductEditValues } from '@/features/products/schemas/product-form.schema';

export function EditProductForm({
  categories,
  currency,
  product,
}: {
  categories: CategoryOption[];
  currency: string;
  product: ProductEditValues;
}): React.JSX.Element {
  return (
    <ProductForm key={product.id} product={product} categories={categories} currency={currency} />
  );
}

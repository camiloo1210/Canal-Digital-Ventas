'use client';

import { ProductForm } from '@/features/products/components/product-form';
import type { CategoryOption } from '@/features/products/components/product-form-fields';

export function CreateProductForm({
  categories,
  currency,
}: {
  categories: CategoryOption[];
  currency: string;
}): React.JSX.Element {
  return <ProductForm categories={categories} currency={currency} />;
}

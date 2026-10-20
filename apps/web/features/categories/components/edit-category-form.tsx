'use client';

import {
  CategoryForm,
  type CategoryEditValues,
} from '@/features/categories/components/category-form';

export function EditCategoryForm({
  initialData,
}: {
  initialData: CategoryEditValues;
}): React.JSX.Element {
  return <CategoryForm key={initialData.id} category={initialData} />;
}

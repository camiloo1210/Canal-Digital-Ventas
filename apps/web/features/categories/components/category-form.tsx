'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  createCategoryAction,
  updateCategoryAction,
} from '@/features/categories/actions/categories.actions';
import type {
  CategoryActionState,
  CategoryFormValues,
} from '@/features/categories/schemas/category-form.schema';
import { CategoryFormFields } from '@/features/categories/components/category-form-fields';
import {
  CatalogFormFeedback,
  useCatalogFormErrors,
} from '@/features/dashboard/components/catalog-form-feedback';
import { CatalogFormActions } from '@/features/dashboard/components/catalog-form-actions';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

const initialState: CategoryActionState = { success: false, error: null };
export interface CategoryEditValues extends CategoryFormValues {
  id: string;
  version: number;
}

export function CategoryForm({ category }: { category?: CategoryEditValues }): React.JSX.Element {
  const [state, formAction, pending] = useActionState(
    category ? updateCategoryAction : createCategoryAction,
    initialState,
  );
  const t = useTranslations('CatalogForms');
  const c = useTranslations('Categories');
  const revision = state.revision ?? 0;
  const { visibleErrors, clearField } = useCatalogFormErrors(state.fieldErrors, revision);
  const error =
    Object.keys(state.fieldErrors ?? {}).length > 0 && Object.keys(visibleErrors).length === 0
      ? null
      : state.error;
  return (
    <form
      action={formAction}
      noValidate
      className="space-y-6"
      onReset={(event): void => event.preventDefault()}
      onSubmit={(event): void => {
        if (!navigator.onLine) {
          event.preventDefault();
          toast.error(c('offline_error'));
        }
      }}
    >
      {category && (
        <>
          <input type="hidden" name="categoryId" value={category.id} />
          <input type="hidden" name="expectedVersion" value={category.version} />
        </>
      )}
      <CatalogFormFeedback
        error={error}
        fieldErrors={visibleErrors}
        labels={{ name: c('form_name'), description: c('form_description') }}
        revision={revision}
      />
      <fieldset disabled={pending} aria-busy={pending} className="min-w-0 disabled:opacity-70">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>
              <h2>{t('categoryTitle')}</h2>
            </CardTitle>
            <CardDescription>{t('categoryDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryFormFields
              revision={revision}
              defaultValues={state.values ?? category}
              fieldErrors={visibleErrors}
              clearField={clearField}
            />
          </CardContent>
        </Card>
      </fieldset>
      <CatalogFormActions
        cancelHref="/dashboard/catalog/categories"
        label={t(category ? 'saveChanges' : 'createCategory')}
        pendingLabel={t('saving')}
      />
    </form>
  );
}

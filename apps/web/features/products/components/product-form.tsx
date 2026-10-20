'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  createProductAction,
  updateProductAction,
} from '@/features/products/actions/products.actions';
import {
  ProductFormFields,
  type CategoryOption,
} from '@/features/products/components/product-form-fields';
import type {
  ProductActionState,
  ProductEditValues,
} from '@/features/products/schemas/product-form.schema';
import {
  CatalogFormFeedback,
  useCatalogFormErrors,
} from '@/features/dashboard/components/catalog-form-feedback';
import { CatalogFormActions } from '@/features/dashboard/components/catalog-form-actions';

const initialState: ProductActionState = { success: false, error: null };

export function ProductForm({
  categories,
  currency,
  product,
}: {
  categories: CategoryOption[];
  currency: string;
  product?: ProductEditValues;
}): React.JSX.Element {
  const [state, formAction, pending] = useActionState(
    product ? updateProductAction : createProductAction,
    initialState,
  );
  const t = useTranslations('CatalogForms');
  const p = useTranslations('Products');
  const revision = state.revision ?? 0;
  const { visibleErrors, clearField } = useCatalogFormErrors(state.fieldErrors, revision);
  const error =
    Object.keys(state.fieldErrors ?? {}).length > 0 && Object.keys(visibleErrors).length === 0
      ? null
      : state.error;
  const labels: Record<string, string> = {
    name: p('form_name'),
    sku: p('form_sku'),
    categoryId: p('form_category'),
    description: p('form_description'),
    price: t('price', { currency }),
    cost: t('cost', { currency }),
    wholesalePrice: t('wholesalePrice', { currency }),
    wholesaleMinQuantity: p('form_wholesale_min'),
    stock: t('stock'),
    image: p('form_image'),
    isVatExempt: p('form_vat'),
  };
  return (
    <form
      action={formAction}
      noValidate
      className="space-y-6"
      onReset={(event): void => event.preventDefault()}
      onSubmit={(event): void => {
        if (!navigator.onLine) {
          event.preventDefault();
          toast.error(p('offline_error'));
        }
      }}
    >
      {product && (
        <>
          <input type="hidden" name="productId" value={product.id} />
          <input type="hidden" name="expectedVersion" value={product.version} />
        </>
      )}
      <CatalogFormFeedback
        error={error}
        fieldErrors={visibleErrors}
        labels={labels}
        revision={revision}
      />
      <fieldset disabled={pending} aria-busy={pending} className="min-w-0 disabled:opacity-70">
        <ProductFormFields
          categories={categories}
          currency={currency}
          defaultValues={state.values ?? product}
          imageUrl={product?.imageUrl}
          revision={revision}
          fieldErrors={visibleErrors}
          clearField={clearField}
        />
      </fieldset>
      <CatalogFormActions
        cancelHref="/dashboard/catalog/products"
        label={t(product ? 'saveChanges' : 'createProduct')}
        pendingLabel={t('saving')}
      />
    </form>
  );
}

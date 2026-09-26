'use client';

import { useActionState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useFormStatus } from 'react-dom';
import {
  ProductFormFields,
  CategoryOption,
} from '@/features/products/components/product-form-fields';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { updateProductAction, ProductActionState } from '@/features/products/actions/products.actions';

const initialState: ProductActionState = {
  success: false,
  error: null as string | null,
};

function SubmitButton(): React.JSX.Element {
  const { pending } = useFormStatus();
  const t = useTranslations('Products');

  return (
    <Button type="submit" className="w-full h-11" disabled={pending}>
      {pending ? (
        <span className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
          {t('submit_updating', { fallback: 'Updating Product...' })}
        </span>
      ) : (
        <span>{t('submit_update', { fallback: 'Update Product' })}</span>
      )}
    </Button>
  );
}

interface EditProductFormProps {
  categories: CategoryOption[];
  product: {
    id: string;
    version: number;
    name: string;
    sku: string;
    price: string;
    cost: string;
    wholesalePrice: string;
    categoryId: string;
    description: string;
    stock: number;
    isVatExempt: boolean;
    imageUrl: string | null;
  };
}

export function EditProductForm({ categories, product }: EditProductFormProps): React.JSX.Element {
  const [state, formAction] = useActionState(updateProductAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const t = useTranslations('Products');

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    if (!navigator.onLine) {
      e.preventDefault();
      toast.error(t('offline_error'));
    }
  };

  return (
    <Card className="border shadow-sm rounded-xl overflow-hidden bg-card">
      <CardContent className="pt-6">
        <form ref={formRef} action={formAction} onSubmit={handleFormSubmit} className="space-y-8">
          <input type="hidden" name="productId" value={product.id} />
          <input type="hidden" name="expectedVersion" value={product.version} />

          {state?.error && (
            <div className="p-4 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
              {state.error === 'concurrency_error'
                ? t('concurrency_error', {
                    fallback:
                      'Product was modified by another user. Please reload before saving your changes.',
                  })
                : state.error}
            </div>
          )}

          <ProductFormFields categories={categories} defaultValues={state.values ?? product} fieldErrors={state.fieldErrors} revision={state.revision} />

          <div className="pt-2">
            <SubmitButton />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

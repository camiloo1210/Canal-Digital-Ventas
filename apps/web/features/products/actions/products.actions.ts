'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { DomainException, ApplicationException } from '@canaldigital/packages/core';
import { createClient } from '@/lib/supabase/server';
import { getActiveTenantQuery } from '@/features/iam/queries/active-tenant.query';
import {
  getCreateProductUseCase,
  getUpdateProductUseCase,
  getArchiveProductUseCase,
  getUnarchiveProductUseCase,
  getStorageAdapter,
} from '@/features/products/di/products.di';
import {
  productFormSchema,
  updateProductFormSchema,
  extractProductFormValues,
  readFormString,
  PRODUCT_IMAGE_MIME_EXTENSIONS,
  type ProductActionState,
  type ProductFieldName,
} from '@/features/products/schemas/product-form.schema';

export type {
  ProductActionState,
  ProductFormValues,
} from '@/features/products/schemas/product-form.schema';
export interface ActionState {
  success: boolean;
  error: string | null;
}

type Translator = Awaited<ReturnType<typeof getTranslations>>;

function productFailure(
  error: unknown,
  t: Translator,
): Pick<ProductActionState, 'error' | 'fieldErrors'> {
  if (error instanceof DomainException || error instanceof ApplicationException) {
    switch (error.name) {
      case 'InvalidWholesaleRulesException':
        return {
          error: t('fixErrors'),
          fieldErrors: {
            wholesalePrice: [t('wholesaleRules')],
            wholesaleMinQuantity: [t('wholesaleRules')],
          },
        };
      case 'InvalidSkuException':
        return { error: t('fixErrors'), fieldErrors: { sku: [t('skuFormat')] } };
      case 'InvalidProductNameException':
        return { error: t('fixErrors'), fieldErrors: { name: [t('nameFormat')] } };
      case 'OptimisticConcurrencyException':
        return { error: t('concurrency') };
      case 'ProductNotFoundException':
        return { error: t('productUnavailable') };
      case 'InvalidProductAttributeException':
      case 'InvalidProductStateException':
        return { error: t('invalidProduct') };
    }
  }
  console.error('[ProductForm]', error);
  return { error: t('unexpected') };
}

async function saveProduct(
  prevState: ProductActionState,
  formData: FormData,
  editing: boolean,
): Promise<ProductActionState> {
  const t = await getTranslations('CatalogForms');
  const values = extractProductFormValues(formData);
  const revision = (prevState.revision ?? 0) + 1;
  const rejected = { success: false, values, revision } as const;
  const image = formData.get('image');
  const input = {
    ...values,
    image: image instanceof File && image.size === 0 ? undefined : (image ?? undefined),
    productId: readFormString(formData, 'productId'),
    expectedVersion: readFormString(formData, 'expectedVersion'),
  };
  const parsed = editing
    ? updateProductFormSchema.safeParse(input)
    : productFormSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<ProductFieldName, string[]>> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0]);
      if (field === 'productId' || field === 'expectedVersion')
        return { ...rejected, error: t('invalidRequest') };
      const name = field as ProductFieldName;
      fieldErrors[name] = [...(fieldErrors[name] ?? []), t(issue.message)];
    }
    return { ...rejected, error: t('fixErrors'), fieldErrors };
  }
  try {
    const client = await createClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return { ...rejected, error: t('unauthorized') };
    const tenantId = await getActiveTenantQuery(user.id);
    if (!tenantId) return { ...rejected, error: t('tenantUnavailable') };
    let imageUrl: string | undefined;
    if (parsed.data.image) {
      const extension =
        PRODUCT_IMAGE_MIME_EXTENSIONS[
          parsed.data.image.type as keyof typeof PRODUCT_IMAGE_MIME_EXTENSIONS
        ];
      const objectKey = `${tenantId}/${crypto.randomUUID()}.${extension}`;
      imageUrl = await getStorageAdapter().uploadImage(parsed.data.image, objectKey);
    }
    const dto = {
      tenantId,
      categoryId: parsed.data.categoryId,
      name: parsed.data.name,
      price: parsed.data.price,
      cost: parsed.data.cost,
      wholesalePrice: parsed.data.wholesalePrice,
      wholesaleMinQuantity: parsed.data.wholesaleMinQuantity,
      description: parsed.data.description,
      sku: parsed.data.sku,
      stock: parsed.data.stock,
      seasonIds: [],
      isVatExempt: parsed.data.isVatExempt,
      ...(imageUrl ? { imagePath: imageUrl, imageUrl } : {}),
    };
    if (editing) {
      if (
        !('productId' in parsed.data) ||
        typeof parsed.data.productId !== 'string' ||
        !('expectedVersion' in parsed.data) ||
        typeof parsed.data.expectedVersion !== 'number'
      )
        return { ...rejected, error: t('invalidRequest') };
      await getUpdateProductUseCase().execute({
        ...dto,
        productId: parsed.data.productId,
        expectedVersion: parsed.data.expectedVersion,
      });
    } else {
      await getCreateProductUseCase().execute({ ...dto, id: crypto.randomUUID() });
    }
  } catch (error: unknown) {
    return { ...rejected, ...productFailure(error, t) };
  }
  revalidatePath('/dashboard/catalog/products');
  revalidatePath('/dashboard');
  redirect('/dashboard/catalog/products');
}

export async function createProductAction(
  prevState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  return saveProduct(prevState, formData, false);
}

export async function updateProductAction(
  prevState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  return saveProduct(prevState, formData, true);
}

async function changeProductArchive(id: string, restore: boolean): Promise<ActionState> {
  const t = await getTranslations('CatalogForms');
  try {
    const client = await createClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return { success: false, error: t('unauthorized') };
    const tenantId = await getActiveTenantQuery(user.id);
    if (!tenantId) return { success: false, error: t('tenantUnavailable') };
    const useCase = restore ? getUnarchiveProductUseCase() : getArchiveProductUseCase();
    await useCase.execute({ id, tenantId });
  } catch (error: unknown) {
    return { success: false, error: productFailure(error, t).error };
  }
  revalidatePath('/dashboard/catalog/products');
  revalidatePath('/dashboard');
  return { success: true, error: null };
}

export async function archiveProductAction(id: string): Promise<ActionState> {
  return changeProductArchive(id, false);
}
export async function unarchiveProductAction(id: string): Promise<ActionState> {
  return changeProductArchive(id, true);
}

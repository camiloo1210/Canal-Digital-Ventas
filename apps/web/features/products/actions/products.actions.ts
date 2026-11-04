'use server';

import { revalidatePath } from 'next/cache';
import { invalidateTenantCatalog } from '@/features/store/utils/catalog-invalidation';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { DomainException, ApplicationException, UserPermission } from '@canaldigital/packages/core';
import { createClient } from '@/lib/supabase/server';
import { resolveActionTenant } from '@/features/dashboard/server/resolve-action-tenant';
import { withTenant } from '@/features/dashboard/utils/tenant-scope';
import { userHasAnyPermission } from '@/features/users/queries/member-permissions.query';
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
  uploadedImagePathsSchema,
  PRODUCT_IMAGE_MAX_BYTES,
  PRODUCT_IMAGE_MIME_EXTENSIONS,
  type ProductActionState,
  type ProductFormValues,
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
      case 'CategoryNotFoundException':
        return { error: t('fixErrors'), fieldErrors: { categoryId: [t('categoryUnavailable')] } };
      case 'OptimisticConcurrencyException':
        return { error: t('concurrency') };
      case 'ProductNotFoundException':
        return { error: t('productUnavailable') };
      case 'InvalidProductAttributeException':
        return error.message.includes('images')
          ? { error: t('fixErrors'), fieldErrors: { image: [t('imageCount')] } }
          : { error: t('invalidProduct') };
      case 'InvalidProductStateException':
        return { error: t('invalidProduct') };
    }
  }
  console.error('[ProductForm]', error);
  return { error: t('unexpected') };
}

function imageRejection(
  rejected: { success: false; values: ProductFormValues; revision: number },
  t: Translator,
  key: string,
): ProductActionState {
  return { ...rejected, error: t('fixErrors'), fieldErrors: { image: [t(key)] } };
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
  const input = {
    ...values,
    uploadedImagePaths: formData
      .getAll('uploadedImagePaths')
      .filter((entry): entry is string => typeof entry === 'string' && entry !== ''),
    existingImages: formData
      .getAll('existingImages')
      .filter((entry): entry is string => typeof entry === 'string' && entry !== ''),
    productId: readFormString(formData, 'productId'),
    expectedVersion: readFormString(formData, 'expectedVersion'),
  };
  const parsed = editing
    ? updateProductFormSchema.safeParse(input)
    : productFormSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<ProductFieldName, string[]>> = {};
    for (const issue of parsed.error.issues) {
      const rawField = String(issue.path[0]);
      const field =
        rawField === 'existingImages' || rawField === 'uploadedImagePaths' ? 'image' : rawField;
      if (field === 'productId' || field === 'expectedVersion')
        return { ...rejected, error: t('invalidRequest') };
      const name = field as ProductFieldName;
      fieldErrors[name] = [...(fieldErrors[name] ?? []), t(issue.message)];
    }
    return { ...rejected, error: t('fixErrors'), fieldErrors };
  }
  let redirectTenantId: string | null = null;
  try {
    const client = await createClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return { ...rejected, error: t('unauthorized') };
    const tenant = await resolveActionTenant(formData, user.id);
    if (!tenant) return { ...rejected, error: t('contextChanged') };
    const tenantId = tenant.tenantId;
    redirectTenantId = tenantId;
    if (!(await userHasAnyPermission(user.id, tenantId, [UserPermission.MANAGE_CATALOG])))
      return { ...rejected, error: t('forbidden') };
    const pathsCheck = uploadedImagePathsSchema(tenantId).safeParse(parsed.data.uploadedImagePaths);
    if (!pathsCheck.success) {
      return imageRejection(rejected, t, pathsCheck.error.issues[0]?.message ?? 'imageFormat');
    }
    const storage = getStorageAdapter();
    const uploadedImages: string[] = [];
    for (const path of pathsCheck.data) {
      const info = await storage.objectInfo(path);
      if (!info.exists) return imageRejection(rejected, t, 'imageUploadMissing');
      if (info.size !== null && info.size > PRODUCT_IMAGE_MAX_BYTES)
        return imageRejection(rejected, t, 'imageSize');
      if (
        info.contentType !== null &&
        !Object.hasOwn(PRODUCT_IMAGE_MIME_EXTENSIONS, info.contentType)
      )
        return imageRejection(rejected, t, 'imageFormat');
      uploadedImages.push(await storage.publicUrl(path));
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
      ...(!editing && uploadedImages.length > 0 ? { galleryUrls: uploadedImages } : {}),
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
        gallery: {
          retainedUrls: formData.get('galleryManaged') === '1' ? parsed.data.existingImages : null,
          addedUrls: uploadedImages,
        },
      });
    } else {
      await getCreateProductUseCase().execute({ ...dto, id: crypto.randomUUID() });
    }
    await invalidateTenantCatalog(tenant.tenantSlug);
  } catch (error: unknown) {
    return { ...rejected, ...productFailure(error, t) };
  }
  revalidatePath('/dashboard/catalog/products');
  revalidatePath('/dashboard');
  redirect(withTenant('/dashboard/catalog/products', redirectTenantId));
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

async function changeProductArchive(
  id: string,
  tenantIdInput: string,
  restore: boolean,
): Promise<ActionState> {
  const t = await getTranslations('CatalogForms');
  try {
    const client = await createClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return { success: false, error: t('unauthorized') };
    const tenant = await resolveActionTenant(tenantIdInput, user.id);
    if (!tenant) return { success: false, error: t('contextChanged') };
    const tenantId = tenant.tenantId;
    if (!(await userHasAnyPermission(user.id, tenantId, [UserPermission.MANAGE_CATALOG])))
      return { success: false, error: t('forbidden') };
    const useCase = restore ? getUnarchiveProductUseCase() : getArchiveProductUseCase();
    await useCase.execute({ id, tenantId });
    await invalidateTenantCatalog(tenant.tenantSlug);
  } catch (error: unknown) {
    return { success: false, error: productFailure(error, t).error };
  }
  revalidatePath('/dashboard/catalog/products');
  revalidatePath('/dashboard');
  return { success: true, error: null };
}

export async function archiveProductAction(id: string, tenantId: string): Promise<ActionState> {
  return changeProductArchive(id, tenantId, false);
}
export async function unarchiveProductAction(id: string, tenantId: string): Promise<ActionState> {
  return changeProductArchive(id, tenantId, true);
}

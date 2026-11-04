'use server';

import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { resolveActionTenant } from '@/features/dashboard/server/resolve-action-tenant';
import { UserPermission } from '@canaldigital/packages/core';
import { userHasAnyPermission } from '@/features/users/queries/member-permissions.query';
import { getStorageAdapter } from '@/features/products/di/products.di';
import { PRODUCT_IMAGE_MIME_EXTENSIONS } from '@/features/products/schemas/product-form.schema';
import {
  productImageUploadsSchema,
  type ProductImageUploadsResult,
} from '@/features/products/schemas/product-image-upload.schema';

export async function createProductImageUploadsAction(input: {
  contentTypes: string[];
  tenantId: string;
}): Promise<ProductImageUploadsResult> {
  const t = await getTranslations('CatalogForms');
  try {
    const client = await createClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return { success: false, errorCode: 'UNAUTHORIZED', message: t('unauthorized') };
    const parsed = productImageUploadsSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, errorCode: 'INVALID_INPUT', message: t('invalidRequest') };
    }
    const tenant = await resolveActionTenant(parsed.data.tenantId, user.id);
    if (!tenant)
      return { success: false, errorCode: 'CONTEXT_CHANGED', message: t('contextChanged') };
    const tenantId = tenant.tenantId;
    if (!(await userHasAnyPermission(user.id, tenantId, [UserPermission.MANAGE_CATALOG])))
      return { success: false, errorCode: 'UNAUTHORIZED', message: t('forbidden') };
    const storage = getStorageAdapter();
    const uploads = await Promise.all(
      parsed.data.contentTypes.map((contentType): Promise<{ path: string; token: string }> =>
        storage.createSignedUpload(
          `${tenantId}/${crypto.randomUUID()}.${PRODUCT_IMAGE_MIME_EXTENSIONS[contentType]}`,
        ),
      ),
    );
    return { success: true, uploads };
  } catch (error: unknown) {
    console.error('[ProductImageUploads]', error);
    return { success: false, errorCode: 'UNEXPECTED', message: t('unexpected') };
  }
}

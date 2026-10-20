'use server';

import { getTranslations } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import {
  DomainException,
  OptimisticConcurrencyException,
  TenantSlugAlreadyInUseException,
} from '@canaldigital/packages/core';
import { createClient } from '@/lib/supabase/server';
import { getActiveTenantQuery } from '@/features/iam/queries/active-tenant.query';
import {
  getStoreSettingsReadRepository,
  getStoreBrandingStorage,
  getUpdateStoreSettingsUseCase,
} from '@/features/store-settings/di/store-settings.di';
import {
  imageExtension,
  isValidBrandingImage,
  storeSettingsSchema,
  type BrandingMime,
} from '@/features/store-settings/schemas/store-settings.schema';

export interface StoreSettingsState {
  revision?: number;
  fieldErrors?: Partial<Record<'name' | 'slug' | 'description' | 'logo' | 'banner', string[]>>;
  success: boolean;
  message: string | null;
  saved?: { slug: string; logoUrl: string | null; bannerUrl: string | null; version: number };
  values?: { name: string; slug: string; description: string };
}

export async function updateStoreSettingsAction(
  previous: StoreSettingsState,
  formData: FormData,
): Promise<StoreSettingsState> {
  const t = await getTranslations('StoreSettings');
  const values = {
    name: String(formData.get('name') ?? ''),
    slug: String(formData.get('slug') ?? ''),
    description: String(formData.get('description') ?? ''),
  };
  const uploaded: string[] = [];
  let committed = false;
  const failure = (
    message: string,
    fieldErrors?: StoreSettingsState['fieldErrors'],
  ): StoreSettingsState => ({
    ...previous,
    success: false,
    message,
    values,
    fieldErrors,
    revision: (previous.revision ?? 0) + 1,
  });
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return failure(t('unauthorized'));
    const tenantId = await getActiveTenantQuery(user.id);
    if (!tenantId) return failure(t('unauthorized'));
    const current = await getStoreSettingsReadRepository().findForManager(user.id, tenantId);
    if (!current) return failure(t('unauthorized'));
    const parsed = storeSettingsSchema.safeParse({
      name: formData.get('name'),
      slug: formData.get('slug'),
      description: formData.get('description'),
      version: formData.get('version'),
      removeLogo: formData.get('removeLogo') === 'on',
      removeBanner: formData.get('removeBanner') === 'on',
    });
    if (!parsed.success) {
      const fieldErrors: NonNullable<StoreSettingsState['fieldErrors']> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === 'name' || field === 'slug' || field === 'description')
          fieldErrors[field] = [t('validation.' + field)];
      }
      return failure(t('invalidInput'), fieldErrors);
    }
    if (parsed.data.version !== current.version) return failure(t('concurrency'));
    const files: Partial<Record<'logo' | 'banner', File>> = {};
    for (const field of ['logo', 'banner'] as const) {
      const file = formData.get(field);
      if (file !== null && !(file instanceof File))
        return failure(t('invalidImage'), { [field]: [t('invalidImage')] });
      if (file instanceof File && file.size > 0) {
        if (!(await isValidBrandingImage(file)))
          return failure(t('invalidImage'), { [field]: [t('invalidImage')] });
        files[field] = file;
      }
    }
    let logoUrl: string | null | undefined = parsed.data.removeLogo ? null : undefined;
    let bannerUrl: string | null | undefined = parsed.data.removeBanner ? null : undefined;
    const storage = getStoreBrandingStorage();
    for (const field of ['logo', 'banner'] as const) {
      const file = files[field];
      if (!file || (field === 'logo' ? parsed.data.removeLogo : parsed.data.removeBanner)) continue;
      const path = `${tenantId}/${crypto.randomUUID()}.${imageExtension(file.type as BrandingMime)}`;
      const url = await storage.uploadImage(file, path);
      uploaded.push(path);
      if (field === 'logo') logoUrl = url;
      else bannerUrl = url;
    }
    await getUpdateStoreSettingsUseCase().execute({
      userId: user.id,
      tenantId,
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description,
      version: parsed.data.version,
      logoUrl,
      bannerUrl,
    });
    committed = true;
    try {
      revalidatePath('/dashboard/store');
      revalidatePath(`/store/${current.slug}`, 'layout');
      if (parsed.data.slug !== current.slug) revalidatePath(`/store/${parsed.data.slug}`, 'layout');
      revalidatePath('/dashboard', 'layout');
      revalidatePath('/');
    } catch (error: unknown) {
      // The transaction already committed. A cache failure must not report a failed mutation.
      console.error('[StoreSettings] Cache refresh failed after saving.', {
        errorType: error instanceof Error ? error.name : 'Unknown',
      });
    }
    return {
      success: true,
      message: t('saved'),
      values,
      fieldErrors: undefined,
      revision: (previous.revision ?? 0) + 1,
      saved: {
        slug: parsed.data.slug,
        logoUrl: logoUrl === undefined ? current.logoUrl : logoUrl,
        bannerUrl: bannerUrl === undefined ? current.bannerUrl : bannerUrl,
        version: current.version + 1,
      },
    };
  } catch (error: unknown) {
    if (!committed && uploaded.length > 0) {
      try {
        const supabase = await createClient();
        await supabase.storage.from('store-branding').remove(uploaded);
      } catch {
        // Cleanup must not prevent returning the user's form values.
      }
    }
    const message =
      error instanceof TenantSlugAlreadyInUseException
        ? t('slugTaken')
        : error instanceof OptimisticConcurrencyException
          ? t('concurrency')
          : error instanceof DomainException
            ? t('invalidProfile')
            : t('unexpected');
    return failure(
      message,
      error instanceof TenantSlugAlreadyInUseException ? { slug: [t('slugTaken')] } : undefined,
    );
  }
}

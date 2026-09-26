'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { DomainException, ApplicationException } from '@canaldigital/packages/core';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getActiveTenantQuery } from '@/features/iam/queries/active-tenant.query';
import {
  getCreateCategoryUseCase,
  getChangeCategoryDetailsUseCase,
  getArchiveCategoryUseCase,
  getUnarchiveCategoryUseCase,
} from '@/features/categories/di/categories.di';
import { getTranslations } from 'next-intl/server';

export interface CategoryFormValues {
  name: string;
  description: string;
}

export type CategoryFieldErrors = Partial<Record<keyof CategoryFormValues, string[]>>;

export interface CategoryActionState {
  success: boolean;
  error: string | null;
  fieldErrors?: CategoryFieldErrors;
  values?: CategoryFormValues;
  revision?: number;
}

function extractCategoryFormValues(formData: FormData): CategoryFormValues {
  return {
    name: formData.get('name')?.toString() || '',
    description: formData.get('description')?.toString() || '',
  };
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const getCreateCategorySchema = (t: Awaited<ReturnType<typeof getTranslations>>) =>
  z.object({
    name: z.string()
      .max(100, t('validation_name_maxLength'))
      .refine((val) => val.trim().length > 0, t('validation_name_required'))
      .transform((val) => val.trim()),
    description: z.string().max(200, t('validation_description_maxLength')).optional().default(''),
  });

export async function createCategoryAction(
  prevState: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const t = await getTranslations('Categories');
  const extractedValues = extractCategoryFormValues(formData);
  const revision = (prevState.revision ?? 0) + 1;

  const parsed = getCreateCategorySchema(t).safeParse(extractedValues);

  if (!parsed.success) {
    return {
      error: null, 
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
      values: extractedValues,
      revision,
    };
  }

  let isSuccess = false;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: t('errors_unexpected'), success: false, values: extractedValues, revision };
    }

    const tenantId = await getActiveTenantQuery(user.id);
    if (!tenantId) {
      return { error: t('errors_unexpected'), success: false, values: extractedValues, revision };
    }

    const useCase = getCreateCategoryUseCase();

    await useCase.execute({
      id: crypto.randomUUID(),
      tenantId: tenantId,
      name: parsed.data.name,
      description: parsed.data.description,
      status: 'active',
    });

    isSuccess = true;
  } catch (error: unknown) {
    if (error instanceof DomainException || error instanceof ApplicationException) {
      if (error.name === 'InvalidCategorySlugException' || error.message.includes('slug')) {
        return { error: t('errors_slugAlreadyExists'), success: false, values: extractedValues, revision };
      }
      return { error: t('errors_unexpected'), success: false, values: extractedValues, revision };
    }
    console.error('Critical Server Exception:', error);
    return { error: t('errors_unexpected'), success: false, values: extractedValues, revision };
  }

  if (isSuccess) {
    revalidatePath('/dashboard/catalog/categories');
    redirect('/dashboard/catalog/categories');
  }

  return { success: false, error: t('errors_unexpected'), values: extractedValues, revision };
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const getUpdateCategorySchema = (t: Awaited<ReturnType<typeof getTranslations>>) =>
  z.object({
    categoryId: z.string().uuid(),
    expectedVersion: z.coerce.number().int().nonnegative(),
    name: z.string()
      .max(100, t('validation_name_maxLength'))
      .refine((val) => val.trim().length > 0, t('validation_name_required'))
      .transform((val) => val.trim()),
    description: z.string().max(200, t('validation_description_maxLength')).optional().default(''),
  });

export async function updateCategoryAction(
  prevState: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const t = await getTranslations('Categories');
  const extractedValues = extractCategoryFormValues(formData);
  const revision = (prevState.revision ?? 0) + 1;

  // Extract non-user-editable fields
  const categoryId = formData.get('categoryId')?.toString();
  const expectedVersion = formData.get('expectedVersion')?.toString();

  const parsed = getUpdateCategorySchema(t).safeParse({
    ...extractedValues,
    categoryId,
    expectedVersion,
  });

  if (!parsed.success) {
    // If categoryId or expectedVersion fails, it's a critical error
    if (parsed.error.flatten().fieldErrors.categoryId || parsed.error.flatten().fieldErrors.expectedVersion) {
      return { error: t('errors_unexpected'), success: false, values: extractedValues, revision };
    }
    return {
      error: null, 
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
      values: extractedValues,
      revision,
    };
  }

  let isSuccess = false;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: t('errors_unexpected'), success: false, values: extractedValues, revision };
    }

    const tenantId = await getActiveTenantQuery(user.id);
    if (!tenantId) {
      return { error: t('errors_unexpected'), success: false, values: extractedValues, revision };
    }

    const useCase = getChangeCategoryDetailsUseCase();

    await useCase.execute({
      id: parsed.data.categoryId,
      tenantId,
      expectedVersion: parsed.data.expectedVersion,
      name: parsed.data.name,
      description: parsed.data.description,
    });

    isSuccess = true;
  } catch (error: unknown) {
    if (error instanceof DomainException || error instanceof ApplicationException) {
      if (error.name === 'OptimisticConcurrencyException') {
        return { error: t('errors_concurrency'), success: false, values: extractedValues, revision };
      }
      return { error: t('errors_unexpected'), success: false, values: extractedValues, revision };
    }
    console.error('Critical Server Exception:', error);
    return { error: t('errors_unexpected'), success: false, values: extractedValues, revision };
  }

  if (isSuccess) {
    revalidatePath('/dashboard/catalog/categories');
    redirect('/dashboard/catalog/categories');
  }

  return { success: false, error: t('errors_unexpected'), values: extractedValues, revision };
}

export async function archiveCategoryAction(id: string): Promise<{ success: boolean; error: string | null }> {
  const t = await getTranslations('Categories');
  let isSuccess = false;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: t('errors_unexpected'), success: false };
    }

    const tenantId = await getActiveTenantQuery(user.id);
    if (!tenantId) {
      return { error: t('errors_unexpected'), success: false };
    }

    const useCase = getArchiveCategoryUseCase();

    await useCase.execute({
      id,
      tenantId,
    });

    isSuccess = true;
  } catch (error: unknown) {
    console.error('Critical Server Exception:', error);
    return { error: t('errors_unexpected'), success: false };
  }

  if (isSuccess) {
    revalidatePath('/dashboard/catalog/categories');
    return { success: true, error: null };
  }

  return { success: false, error: t('errors_unexpected') };
}

export async function unarchiveCategoryAction(id: string): Promise<{ success: boolean; error: string | null }> {
  const t = await getTranslations('Categories');
  let isSuccess = false;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: t('errors_unexpected'), success: false };
    }

    const tenantId = await getActiveTenantQuery(user.id);
    if (!tenantId) {
      return { error: t('errors_unexpected'), success: false };
    }

    const useCase = getUnarchiveCategoryUseCase();

    await useCase.execute({
      id,
      tenantId,
    });

    isSuccess = true;
  } catch (error: unknown) {
    console.error('Critical Server Exception:', error);
    return { error: t('errors_unexpected'), success: false };
  }

  if (isSuccess) {
    revalidatePath('/dashboard/catalog/categories');
    return { success: true, error: null };
  }

  return { success: false, error: t('errors_unexpected') };
}

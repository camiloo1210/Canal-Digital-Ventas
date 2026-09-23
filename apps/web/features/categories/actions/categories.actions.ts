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

const createCategorySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters long'),
  description: z.string().optional().default(''),
});

export interface ActionState {
  success: boolean;
  error: string | null;
}

export async function createCategoryAction(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const rawData = Object.fromEntries(formData.entries());

  let parsed;
  try {
    parsed = createCategorySchema.safeParse(rawData);
  } catch (err: unknown) {
    if (err instanceof Error) {
      return { error: err.message, success: false };
    }
    return { error: 'Invalid data format', success: false };
  }

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, success: false };
  }

  let isSuccess = false;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'Unauthorized session.', success: false };
    }

    const tenantId = await getActiveTenantQuery(user.id);
    if (!tenantId) {
      return { error: 'User does not have an assigned tenant ID.', success: false };
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
    if (error instanceof DomainException) {
      return { error: error.message, success: false };
    }
    if (error instanceof ApplicationException) {
      return { error: error.message, success: false };
    }
    console.error('Critical Server Exception:', error);
    return { error: 'An unexpected server error occurred.', success: false };
  }

  if (isSuccess) {
    revalidatePath('/dashboard/catalog/categories');
    redirect('/dashboard/catalog/categories');
  }

  return { success: false, error: 'Failed to process request.' };
}

const updateCategorySchema = z.object({
  categoryId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().nonnegative(),
  name: z.string().min(2, 'Name must be at least 2 characters long'),
  description: z.string().optional().default(''),
});

export async function updateCategoryAction(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const rawData = Object.fromEntries(formData.entries());

  let parsed;
  try {
    parsed = updateCategorySchema.safeParse(rawData);
  } catch (err: unknown) {
    if (err instanceof Error) {
      return { error: err.message, success: false };
    }
    return { error: 'Invalid data format', success: false };
  }

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, success: false };
  }

  let isSuccess = false;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'Unauthorized session.', success: false };
    }

    const tenantId = await getActiveTenantQuery(user.id);
    if (!tenantId) {
      return { error: 'User does not have an assigned tenant ID.', success: false };
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
    if (error instanceof DomainException) {
      return { error: error.message, success: false };
    }
    if (error instanceof ApplicationException) {
      if (error.name === 'OptimisticConcurrencyException') {
        return { error: 'concurrency_error', success: false };
      }
      return { error: error.message, success: false };
    }
    console.error('Critical Server Exception:', error);
    return { error: 'An unexpected server error occurred.', success: false };
  }

  if (isSuccess) {
    revalidatePath('/dashboard/catalog/categories');
    redirect('/dashboard/catalog/categories');
  }

  return { success: false, error: 'Failed to process request.' };
}

export async function archiveCategoryAction(id: string): Promise<ActionState> {
  let isSuccess = false;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'Unauthorized session.', success: false };
    }

    const tenantId = await getActiveTenantQuery(user.id);
    if (!tenantId) {
      return { error: 'User does not have an assigned tenant ID.', success: false };
    }

    const useCase = getArchiveCategoryUseCase();

    await useCase.execute({
      id,
      tenantId,
    });

    isSuccess = true;
  } catch (error: unknown) {
    if (error instanceof DomainException) {
      return { error: error.message, success: false };
    }
    if (error instanceof ApplicationException) {
      return { error: error.message, success: false };
    }
    console.error('Critical Server Exception:', error);
    return { error: 'An unexpected server error occurred.', success: false };
  }

  if (isSuccess) {
    revalidatePath('/dashboard/catalog/categories');
    return { success: true, error: null };
  }

  return { success: false, error: 'Failed to process request.' };
}

export async function unarchiveCategoryAction(id: string): Promise<ActionState> {
  let isSuccess = false;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'Unauthorized session.', success: false };
    }

    const tenantId = await getActiveTenantQuery(user.id);
    if (!tenantId) {
      return { error: 'User does not have an assigned tenant ID.', success: false };
    }

    const useCase = getUnarchiveCategoryUseCase();

    await useCase.execute({
      id,
      tenantId,
    });

    isSuccess = true;
  } catch (error: unknown) {
    if (error instanceof DomainException) {
      return { error: error.message, success: false };
    }
    if (error instanceof ApplicationException) {
      return { error: error.message, success: false };
    }
    console.error('Critical Server Exception:', error);
    return { error: 'An unexpected server error occurred.', success: false };
  }

  if (isSuccess) {
    revalidatePath('/dashboard/catalog/categories');
    return { success: true, error: null };
  }

  return { success: false, error: 'Failed to process request.' };
}

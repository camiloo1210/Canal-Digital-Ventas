'use server';

import { z } from 'zod';
import { getCreateProductUseCase, getStorageAdapter } from '@/features/products/di/products.di';
import { revalidatePath } from 'next/cache';
import { DomainException, ApplicationException } from '@canaldigital/packages/core';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { parseToMinorUnits } from '@/lib/money';
import { getActiveTenantQuery } from '@/features/iam/queries/active-tenant.query';

const createProductSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters long'),
  sku: z.string().min(1, 'SKU is required'),
  price: z.union([z.string(), z.number()]).transform(parseToMinorUnits),
  cost: z.union([z.string(), z.number()]).transform(parseToMinorUnits),
  wholesalePrice: z
    .union([z.string(), z.number()])
    .nullable()
    .transform((v) => (v ? parseToMinorUnits(v) : null))
    .optional(),
  categoryId: z.string().uuid('Please select a valid category'),
  description: z.string().optional().default(''),
  stock: z.coerce.number().int().nonnegative('Stock must be non-negative').default(0),
  isVatExempt: z.preprocess((val) => val === 'true' || val === 'on', z.boolean()),
  imageFile: z.instanceof(File).optional(),
});

export interface ActionState {
  success: boolean;
  error: string | null;
}

export async function createProductAction(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const rawData = Object.fromEntries(formData.entries());

  const imageField = formData.get('image');
  const imageFile = imageField instanceof File && imageField.size > 0 ? imageField : undefined;

  let parsed;
  try {
    parsed = createProductSchema.safeParse({
      ...rawData,
      imageFile,
    });
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

    let publicUrl = undefined;
    if (parsed.data.imageFile) {
      const storageAdapter = getStorageAdapter();
      const fileName = `${crypto.randomUUID()}-${parsed.data.imageFile.name}`;
      publicUrl = await storageAdapter.uploadImage(parsed.data.imageFile, fileName);
    }

    const useCase = await getCreateProductUseCase();

    await useCase.execute({
      id: crypto.randomUUID(),
      tenantId: tenantId,
      categoryId: parsed.data.categoryId,
      name: parsed.data.name,
      price: parsed.data.price,
      cost: parsed.data.cost,
      wholesalePrice: parsed.data.wholesalePrice || null,
      description: parsed.data.description,
      sku: parsed.data.sku,
      imagePath: publicUrl,
      imageUrl: publicUrl,
      stock: parsed.data.stock,
      seasonIds: [],
      isVatExempt: parsed.data.isVatExempt,
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
    revalidatePath('/dashboard/catalog/products');
    redirect('/dashboard/catalog/products');
  }

  return { success: false, error: 'Failed to process request.' };
}

const updateProductSchema = z.object({
  productId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().nonnegative(),
  name: z.string().min(2, 'Name must be at least 2 characters long'),
  sku: z.string().min(1, 'SKU is required'),
  price: z.union([z.string(), z.number()]).transform(parseToMinorUnits),
  cost: z.union([z.string(), z.number()]).transform(parseToMinorUnits),
  wholesalePrice: z
    .union([z.string(), z.number()])
    .nullable()
    .transform((v) => (v ? parseToMinorUnits(v) : null))
    .optional(),
  categoryId: z.string().uuid('Please select a valid category'),
  description: z.string().optional().default(''),
  stock: z.coerce.number().int().nonnegative('Stock must be non-negative').default(0),
  isVatExempt: z.preprocess((val) => val === 'true' || val === 'on', z.boolean()),
});

export async function updateProductAction(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const rawData = Object.fromEntries(formData.entries());

  let parsed;
  try {
    parsed = updateProductSchema.safeParse(rawData);
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

    const { getUpdateProductUseCase } = await import('@/features/products/di/products.di');
    const useCase = await getUpdateProductUseCase();

    await useCase.execute({
      productId: parsed.data.productId,
      tenantId,
      expectedVersion: parsed.data.expectedVersion,
      categoryId: parsed.data.categoryId,
      name: parsed.data.name,
      price: parsed.data.price,
      cost: parsed.data.cost,
      wholesalePrice: parsed.data.wholesalePrice || null,
      description: parsed.data.description,
      sku: parsed.data.sku,
      stock: parsed.data.stock,
      seasonIds: [],
      isVatExempt: parsed.data.isVatExempt,
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
    revalidatePath('/dashboard/catalog/products');
    redirect('/dashboard/catalog/products');
  }

  return { success: false, error: 'Failed to process request.' };
}

export async function archiveProductAction(id: string): Promise<ActionState> {
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

    const { getArchiveProductUseCase } = await import('@/features/products/di/products.di');
    const useCase = await getArchiveProductUseCase();

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
    revalidatePath('/dashboard/catalog/products');
    return { success: true, error: null };
  }

  return { success: false, error: 'Failed to process request.' };
}

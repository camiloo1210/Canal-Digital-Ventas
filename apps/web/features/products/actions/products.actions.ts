'use server';

import { z } from 'zod';
import { getCreateProductUseCase, getStorageAdapter } from '@/features/products/di/products.di';
import { revalidatePath } from 'next/cache';
import { DomainException } from '@canaldigital/packages/core';
import { createClient } from '@/lib/supabase/server';
// Removed inline storage adapter import

// 1. Define the correct shape of the data using Zod
const createProductSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters long'),
  sku: z.string().min(1, 'SKU is required'),
  price: z.coerce.number().positive('Price must be greater than 0'),
  cost: z.coerce.number().positive('Cost must be greater than 0'),
  wholesalePrice: z.coerce
    .number()
    .positive('Wholesale price must be greater than 0')
    .nullable()
    .optional(),
  categoryId: z.string().uuid('Please select a valid category'),
  description: z.string().optional().default(''),
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
  // Parse, Don't Validate
  const rawData = Object.fromEntries(formData.entries());

  const imageField = formData.get('image');
  const imageFile = imageField instanceof File && imageField.size > 0 ? imageField : undefined;

  const parsed = createProductSchema.safeParse({
    ...rawData,
    imageFile,
    wholesalePrice: rawData.wholesalePrice ? rawData.wholesalePrice : null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, success: false };
  }

  try {
    let publicUrl = undefined;

    // Upload image to Supabase Storage if it exists
    if (parsed.data.imageFile) {
      const storageAdapter = getStorageAdapter();
      // Generate a secure unique name to avoid collisions
      const fileName = `${crypto.randomUUID()}-${parsed.data.imageFile.name}`;
      publicUrl = await storageAdapter.uploadImage(parsed.data.imageFile, fileName);
    }

    const useCase = await getCreateProductUseCase();

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'Unauthorized user', success: false };
    }

    const rawTenantId = user.app_metadata?.app_tenant_id;

    if (!rawTenantId) {
      return { error: 'User does not have an assigned tenant ID.', success: false };
    }

    // Call the core Use Case passing primitive, clean DTOs
    await useCase.execute({
      id: crypto.randomUUID(),
      tenantId: rawTenantId,
      categoryId: parsed.data.categoryId,
      name: parsed.data.name,
      price: parsed.data.price,
      cost: parsed.data.cost,
      wholesalePrice: parsed.data.wholesalePrice || null,
      description: parsed.data.description,
      sku: parsed.data.sku,
      imagePath: publicUrl, // Using the public URL for both path and URL fields for now
      imageUrl: publicUrl,
      stock: 0,
      seasonIds: [],
      isVatExempt: parsed.data.isVatExempt,
    });

    // Clear the cache for this route so new data is read from the DB
    revalidatePath('/dashboard/catalog/products');

    return { success: true, error: null };
  } catch (error: unknown) {
    // Catch native core architecture exceptions
    if (error instanceof DomainException) {
      return { error: error.message, success: false };
    }
    console.error('Critical Server Error:', error);
    return { error: 'An unexpected server error occurred.', success: false };
  }
}

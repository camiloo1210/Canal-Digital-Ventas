'use server';

import { z } from 'zod';
import { getCreateProductUseCase } from '@/features/products/di/products.di';
import { revalidatePath } from 'next/cache';
import { DomainException } from '@canaldigital/packages/core';
import { SupabaseStorageAdapter } from '@/lib/storage/supabase-storage.adapter';

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

export async function createProductAction(prevState: any, formData: FormData) {
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
      const storageAdapter = new SupabaseStorageAdapter();
      // Generate a secure unique name to avoid collisions
      const fileName = `${crypto.randomUUID()}-${parsed.data.imageFile.name}`;
      publicUrl = await storageAdapter.uploadImage(parsed.data.imageFile, fileName);
    }

    const useCase = await getCreateProductUseCase();

    // Tenant Mock (until Auth is added)
    const mockTenantId = '11111111-1111-1111-1111-111111111111';

    // Call the core Use Case passing primitive, clean DTOs
    await useCase.execute({
      id: crypto.randomUUID(),
      tenantId: mockTenantId,
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
    revalidatePath('/products');

    return { success: true, error: null };
  } catch (error: any) {
    // Catch native core architecture exceptions
    if (error instanceof DomainException) {
      return { error: error.message, success: false };
    }
    console.error('Critical Server Error:', error);
    return { error: 'An unexpected server error occurred.', success: false };
  }
}

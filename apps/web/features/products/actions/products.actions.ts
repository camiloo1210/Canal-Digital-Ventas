
'use server';

import { z } from 'zod';
import { getCreateProductUseCase, getUpdateProductUseCase, getArchiveProductUseCase,
  getUnarchiveProductUseCase, getStorageAdapter } from '@/features/products/di/products.di';
import { revalidatePath } from 'next/cache';
import { DomainException, ApplicationException } from '@canaldigital/packages/core';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { parseToMinorUnits } from '@/lib/money';
import { getActiveTenantQuery } from '@/features/iam/queries/active-tenant.query';

const IMAGE_EXTENSION_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

type AllowedImageMime = keyof typeof IMAGE_EXTENSION_BY_MIME;

const moneyRegex = /^\d+(\.\d{1,2})?$/;
const moneyFieldSchema = z
  .union([z.string(), z.number()])
  .refine(
    (val) => {
      if (typeof val === 'number') return val >= 0;
      return moneyRegex.test(val);
    },
    { message: 'Invalid format (e.g. 10.99)' }
  )
  .transform(parseToMinorUnits);

const optionalMoneySchema = z
  .union([z.string(), z.number()])
  .nullable()
  .optional()
  .transform((val) => (val === '' || val === null || val === undefined ? null : val))
  .pipe(
    z.union([
      z.null(),
      moneyFieldSchema
    ])
  );

const createProductSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters long').max(50, 'Name must not exceed 50 characters'),
  sku: z.string().regex(/^[A-Z0-9-]{5,20}$/, 'SKU must be 5-20 characters long and contain only uppercase letters, numbers, and dashes'),
  price: moneyFieldSchema,
  cost: moneyFieldSchema,
  wholesalePrice: optionalMoneySchema,
  categoryId: z.string().uuid('Please select a valid category'),
  description: z.string().max(200, 'Description must not exceed 200 characters').optional().default(''),
  stock: z.coerce.number().int().nonnegative('Stock must be non-negative').default(0),
  isVatExempt: z.preprocess((val) => val === 'true' || val === 'on', z.boolean()),
  imageFile: z.instanceof(File)
    .refine((file) => Object.keys(IMAGE_EXTENSION_BY_MIME).includes(file.type), {
      message: 'Invalid image format. Allowed: JPEG, PNG, WebP',
    })
    .optional(),
});

export interface ActionState {
  success: boolean;
  error: string | null;
}

export interface ProductFormValues {
  name: string;
  sku: string;
  categoryId: string;
  description: string;
  price: string;
  cost: string;
  wholesalePrice: string;
  stock: string;
  isVatExempt: string;
}

export interface ProductActionState {
  success: boolean;
  error: string | null;
  fieldErrors?: Partial<Record<keyof ProductFormValues, string[]>>;
  values?: ProductFormValues;
  revision?: number;
}

function normalizeSku(value: string): string {
  if (!value) return value;
  const stripped = value.trim().replace(/^(?:sku[\s-]*)+/i, '');
  if (!stripped) return value;
  return `SKU-${stripped.toUpperCase()}`;
}

function extractProductFormValues(formData: FormData): ProductFormValues {
  return {
    name: (formData.get('name') as string) || '',
    sku: normalizeSku((formData.get('sku') as string) || ''),
    categoryId: (formData.get('categoryId') as string) || '',
    description: (formData.get('description') as string) || '',
    price: (formData.get('price') as string) || '',
    cost: (formData.get('cost') as string) || '',
    wholesalePrice: (formData.get('wholesalePrice') as string) || '',
    stock: (formData.get('stock') as string) || '',
    isVatExempt: (formData.get('isVatExempt') as string) || '',
  };
}

export async function createProductAction(
  prevState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const rawData = Object.fromEntries(formData.entries());
  if (typeof rawData.sku === 'string') {
    rawData.sku = normalizeSku(rawData.sku);
  }
  const extractedValues = extractProductFormValues(formData);
  const imageField = formData.get('image');

    let imageFile: File | undefined = undefined;
  
  if (imageField !== null) {
    if (imageField instanceof File) {
      if (imageField.size > 0) {
        imageFile = imageField;       }
          } else {
            return { 
        error: 'System error: The image field payload is invalid. Expected a binary file.',
        success: false, 
        values: extractedValues, 
        revision: (prevState.revision || 0) + 1 
      };
    }
  }

  let parsed;
  try {
    parsed = createProductSchema.safeParse({
      ...rawData,
      imageFile,
    });
  } catch (err: unknown) {
    if (err instanceof Error) {
      return { error: err.message, success: false, values: extractedValues, revision: (prevState.revision || 0) + 1 };
    }
    return { error: 'Invalid data format', success: false, values: extractedValues, revision: (prevState.revision || 0) + 1 };
  }

  if (!parsed.success) {
    return { 
      error: 'Please fix the highlighted errors.', 
      success: false, 
      fieldErrors: parsed.error.flatten().fieldErrors,
      values: extractedValues,
      revision: (prevState.revision || 0) + 1,
    };
  }

  let isSuccess = false;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'Unauthorized session.', success: false, values: extractedValues,
      revision: (prevState.revision || 0) + 1,
    };
    }

    const tenantId = await getActiveTenantQuery(user.id);
    if (!tenantId) {
      return { error: 'User does not have an assigned tenant ID.', success: false, values: extractedValues,
      revision: (prevState.revision || 0) + 1,
    };
    }

    let publicUrl = undefined;
    if (parsed.data.imageFile) {
      const storageAdapter = getStorageAdapter();
      const mimeType = parsed.data.imageFile.type as AllowedImageMime;
      const extension = IMAGE_EXTENSION_BY_MIME[mimeType];
      const fileName = `${tenantId}/${crypto.randomUUID()}.${extension}`;
      publicUrl = await storageAdapter.uploadImage(parsed.data.imageFile, fileName);
    }

    const useCase = getCreateProductUseCase();

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
      return { error: error.message, success: false, values: extractedValues,
      revision: (prevState.revision || 0) + 1,
    };
    }
    if (error instanceof ApplicationException) {
      return { error: error.message, success: false, values: extractedValues,
      revision: (prevState.revision || 0) + 1,
    };
    }
    console.error('Critical Server Exception:', error);
    return { error: 'An unexpected server error occurred.', success: false, values: extractedValues,
      revision: (prevState.revision || 0) + 1,
    };
  }

  if (isSuccess) {
    revalidatePath('/dashboard/catalog/products');
    redirect('/dashboard/catalog/products');
  }

  return { success: false, error: 'Failed to process request.', values: extractedValues,
      revision: (prevState.revision || 0) + 1,
    };
}

const updateProductSchema = z.object({
  productId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().nonnegative(),
  name: z.string().trim().min(2, 'Name must be at least 2 characters long').max(50, 'Name must not exceed 50 characters'),
  sku: z.string().regex(/^[A-Z0-9-]{5,20}$/, 'SKU must be 5-20 characters long and contain only uppercase letters, numbers, and dashes'),
  price: moneyFieldSchema,
  cost: moneyFieldSchema,
  wholesalePrice: optionalMoneySchema,
  categoryId: z.string().uuid('Please select a valid category'),
  description: z.string().max(200, 'Description must not exceed 200 characters').optional().default(''),
  stock: z.coerce.number().int().nonnegative('Stock must be non-negative').default(0),
  isVatExempt: z.preprocess((val) => val === 'true' || val === 'on', z.boolean()),
});

export async function updateProductAction(
  prevState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const rawData = Object.fromEntries(formData.entries());
  if (typeof rawData.sku === 'string') {
    rawData.sku = normalizeSku(rawData.sku);
  }
  const extractedValues = extractProductFormValues(formData);

  let parsed;
  try {
    parsed = updateProductSchema.safeParse(rawData);
  } catch (err: unknown) {
    if (err instanceof Error) {
      return { error: err.message, success: false, values: extractedValues, revision: (prevState.revision || 0) + 1 };
    }
    return { error: 'Invalid data format', success: false, values: extractedValues, revision: (prevState.revision || 0) + 1 };
  }

  if (!parsed.success) {
    return { 
      error: 'Please fix the highlighted errors.', 
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
      values: extractedValues,
      revision: (prevState.revision || 0) + 1,
    };
  }

  let isSuccess = false;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'Unauthorized session.', success: false, values: extractedValues,
      revision: (prevState.revision || 0) + 1,
    };
    }

    const tenantId = await getActiveTenantQuery(user.id);
    if (!tenantId) {
      return { error: 'User does not have an assigned tenant ID.', success: false, values: extractedValues,
      revision: (prevState.revision || 0) + 1,
    };
    }

    const useCase = getUpdateProductUseCase();

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
      return { error: error.message, success: false, values: extractedValues,
      revision: (prevState.revision || 0) + 1,
    };
    }
    if (error instanceof ApplicationException) {
      if (error.name === 'OptimisticConcurrencyException') {
        return { error: 'concurrency_error', success: false, values: extractedValues,
      revision: (prevState.revision || 0) + 1,
    };
      }
      return { error: error.message, success: false, values: extractedValues,
      revision: (prevState.revision || 0) + 1,
    };
    }
    console.error('Critical Server Exception:', error);
    return { error: 'An unexpected server error occurred.', success: false, values: extractedValues,
      revision: (prevState.revision || 0) + 1,
    };
  }

  if (isSuccess) {
    revalidatePath('/dashboard/catalog/products');
    redirect('/dashboard/catalog/products');
  }

  return { success: false, error: 'Failed to process request.', values: extractedValues,
      revision: (prevState.revision || 0) + 1,
    };
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

    const useCase = getArchiveProductUseCase();

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

export async function unarchiveProductAction(id: string): Promise<ActionState> {
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

    const useCase = getUnarchiveProductUseCase();

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

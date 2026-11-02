import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from 'next-intl';
import es from '@/messages/es.json';
import {
  createProductAction,
  updateProductAction,
} from '@/features/products/actions/products.actions';
import { InvalidProductAttributeException } from '@/products/domain/exceptions/invalid-product-attribute.exception';
import { InvalidWholesaleRulesException } from '@/products/domain/exceptions/invalid-wholesale-rules.exception';
import { OptimisticConcurrencyException } from '@/shared/application/exceptions/optimistic-concurrency.exception';

const mocks = vi.hoisted(
  (): {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    publicUrl: ReturnType<typeof vi.fn>;
    upload: ReturnType<typeof vi.fn>;
    user: ReturnType<typeof vi.fn>;
    tenant: ReturnType<typeof vi.fn>;
  } => ({
    create: vi.fn(),
    update: vi.fn(),
    info: vi.fn(),
    publicUrl: vi.fn(),
    upload: vi.fn(),
    user: vi.fn(),
    tenant: vi.fn(),
  }),
);
vi.mock('next-intl/server', (): object => ({
  getTranslations: async (): Promise<ReturnType<typeof createTranslator>> =>
    createTranslator({ locale: 'es', messages: es.CatalogForms }),
}));
vi.mock('@/features/products/di/products.di', (): object => ({
  getCreateProductUseCase: (): object => ({ execute: mocks.create }),
  getUpdateProductUseCase: (): object => ({ execute: mocks.update }),
  getStorageAdapter: (): object => ({
    uploadImage: mocks.upload,
    objectInfo: mocks.info,
    publicUrl: mocks.publicUrl,
  }),
}));
vi.mock('@/lib/supabase/server', (): object => ({
  createClient: async (): Promise<object> => ({ auth: { getUser: mocks.user } }),
}));
vi.mock('@/features/iam/queries/active-tenant.query', (): object => ({
  getActiveTenantQuery: mocks.tenant,
}));
vi.mock('next/cache', (): object => ({ revalidatePath: vi.fn() }));
vi.mock('@/features/store/utils/catalog-invalidation', (): object => ({
  invalidateActiveTenantCatalog: vi.fn(),
}));
vi.mock('next/navigation', (): object => ({
  redirect: (): never => {
    throw new Error('NEXT_REDIRECT');
  },
}));

const UUID_A = '3f2b8c1e-5d4a-4b6c-8e7f-0a1b2c3d4e5f';
const UUID_B = '9a8b7c6d-1e2f-4a3b-9c4d-5e6f7a8b9c0d';
const pathA = `real-tenant/${UUID_A}.png`;
const pathB = `real-tenant/${UUID_B}.webp`;

function form(): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries({
    productId: '550e8400-e29b-41d4-a716-446655440000',
    expectedVersion: '4',
    name: 'Updated product',
    sku: 'ABC123',
    categoryId: '650e8400-e29b-41d4-a716-446655440000',
    description: 'Keep these values',
    price: '101.05',
    cost: '10.00',
    wholesalePrice: '70.00',
    wholesaleMinQuantity: '37',
    stock: '12',
    isVatExempt: 'on',
    tenantId: 'attacker-tenant',
  }))
    data.set(name, value);
  return data;
}
const initial = { success: false, error: null };

describe('product form delivery', (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
    mocks.user.mockResolvedValue({ data: { user: { id: 'actor' } } });
    mocks.tenant.mockResolvedValue('real-tenant');
    mocks.create.mockResolvedValue('product');
    mocks.update.mockResolvedValue(undefined);
    mocks.info.mockResolvedValue({ exists: true, size: 1000, contentType: 'image/png' });
    mocks.publicUrl.mockImplementation(
      async (path: string): Promise<string> => 'https://example.test/' + path,
    );
  });
  it('preserves wholesale minimum, SKU and minor units when only another detail changes', async (): Promise<void> => {
    await expect(updateProductAction(initial, form())).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedVersion: 4,
        wholesaleMinQuantity: 37,
        wholesalePrice: 7000,
        sku: 'ABC123',
        price: 10105,
        tenantId: 'real-tenant',
      }),
    );
    expect(mocks.tenant).toHaveBeenCalledWith('actor');
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('retains all submitted strings after a concurrency rejection', async (): Promise<void> => {
    mocks.update.mockRejectedValue(new OptimisticConcurrencyException('Product', 'product'));
    const result = await updateProductAction(initial, form());
    expect(result.values).toMatchObject({
      wholesaleMinQuantity: '37',
      sku: 'ABC123',
      price: '101.05',
      isVatExempt: 'on',
      description: 'Keep these values',
    });
    expect(result.error).toContain('Otro usuario');
    expect(result.revision).toBe(1);
  });
  it('maps wholesale invariant failures from Core to both fields', async (): Promise<void> => {
    mocks.create.mockRejectedValue(new InvalidWholesaleRulesException('private domain message'));
    const result = await createProductAction(initial, form());
    expect(result.fieldErrors?.wholesaleMinQuantity?.[0]).toContain('cantidad mínima');
    expect(result.fieldErrors?.wholesalePrice?.[0]).toContain('precio');
    expect(result.error).not.toContain('private domain');
  });
  it('validates syntax without discarding invalid values or adding a SKU prefix', async (): Promise<void> => {
    const data = form();
    data.set('price', '12abc');
    data.set('wholesaleMinQuantity', '7x');
    const result = await updateProductAction(initial, data);
    expect(result.values).toMatchObject({
      price: '12abc',
      wholesaleMinQuantity: '7x',
      sku: 'ABC123',
    });
    expect(result.fieldErrors?.price?.[0]).toContain('importe válido');
    expect(result.fieldErrors?.wholesaleMinQuantity?.[0]).toContain('número entero');
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('ignores File parts entirely: no binary reaches storage or the use case', async (): Promise<void> => {
    const data = form();
    data.set('image', new File(['x'], 'a.png', { type: 'image/png' }));
    await expect(updateProductAction(initial, data)).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ gallery: { retainedUrls: null, addedUrls: [] } }),
    );
  });
  it.each([
    ['another tenant', `other-tenant/${UUID_A}.png`],
    ['path traversal', `real-tenant/../other-tenant/${UUID_A}.png`],
    ['an absolute URL', `https://evil.test/real-tenant/${UUID_A}.png`],
    ['an arbitrary string', 'real-tenant/photo.png'],
    ['a non v4 uuid', 'real-tenant/3f2b8c1e-5d4a-1b6c-8e7f-0a1b2c3d4e5f.png'],
    ['a bad extension', `real-tenant/${UUID_A}.gif`],
  ])('rejects %s as an uploaded image path', async (_name, path): Promise<void> => {
    const data = form();
    data.delete('productId');
    data.delete('expectedVersion');
    data.append('uploadedImagePaths', path);
    const result = await createProductAction(initial, data);
    expect(result.fieldErrors?.image).toBeDefined();
    expect(mocks.info).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('rejects duplicate paths and more than 8 paths', async (): Promise<void> => {
    const dup = form();
    dup.append('uploadedImagePaths', pathA);
    dup.append('uploadedImagePaths', pathA);
    expect((await updateProductAction(initial, dup)).fieldErrors?.image).toBeDefined();
    const many = form();
    for (let i = 0; i < 9; i += 1)
      many.append('uploadedImagePaths', `real-tenant/${crypto.randomUUID()}.png`);
    expect((await updateProductAction(initial, many)).fieldErrors?.image?.[0]).toContain('8');
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('reports a missing storage object on the image field', async (): Promise<void> => {
    mocks.info.mockResolvedValue({ exists: false, size: null, contentType: null });
    const data = form();
    data.append('uploadedImagePaths', pathA);
    const result = await updateProductAction(initial, data);
    expect(result.fieldErrors?.image?.[0]).toContain('no terminó de subirse');
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('rejects oversized stored objects', async (): Promise<void> => {
    mocks.info.mockResolvedValue({
      exists: true,
      size: 5 * 1024 * 1024 + 1,
      contentType: 'image/png',
    });
    const data = form();
    data.append('uploadedImagePaths', pathA);
    expect((await updateProductAction(initial, data)).fieldErrors?.image?.[0]).toContain('5 MB');
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('turns verified own-tenant paths into public URLs on update', async (): Promise<void> => {
    const data = form();
    data.append('uploadedImagePaths', pathA);
    data.append('uploadedImagePaths', pathB);
    await expect(updateProductAction(initial, data)).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.info).toHaveBeenCalledWith(pathA);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        gallery: {
          retainedUrls: null,
          addedUrls: ['https://example.test/' + pathA, 'https://example.test/' + pathB],
        },
        wholesaleMinQuantity: 37,
      }),
    );
    const dto: Record<string, unknown> = mocks.update.mock.calls[0][0] as Record<string, unknown>;
    expect(
      Object.values(dto).some(
        (value): boolean => value instanceof File || value instanceof FormData,
      ),
    ).toBe(false);
  });
  it('requires authentication before upload and does not fall back to creation for malformed edits', async (): Promise<void> => {
    const data = form();
    data.set('expectedVersion', '');
    expect((await updateProductAction(initial, data)).error).toContain('identificar esta edición');
    mocks.user.mockResolvedValue({ data: { user: null } });
    expect((await updateProductAction(initial, form())).error).toContain('sesión');
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it('forwards the retained and newly uploaded images to the use case without deciding ownership', async (): Promise<void> => {
    const data = form();
    data.set('galleryManaged', '1');
    data.append('existingImages', 'https://example.test/b.png');
    data.append('uploadedImagePaths', pathA);
    data.append('uploadedImagePaths', pathB);
    await expect(updateProductAction(initial, data)).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        gallery: {
          retainedUrls: ['https://example.test/b.png'],
          addedUrls: ['https://example.test/' + pathA, 'https://example.test/' + pathB],
        },
      }),
    );
  });
  it('maps the domain image-limit rejection to the image field', async (): Promise<void> => {
    mocks.update.mockRejectedValue(
      new InvalidProductAttributeException('A product cannot have more than 8 images.'),
    );
    const result = await updateProductAction(initial, form());
    expect(result.fieldErrors?.image?.[0]).toContain('8');
  });
  it('creates a product with several uploaded images', async (): Promise<void> => {
    const data = form();
    data.delete('productId');
    data.delete('expectedVersion');
    data.append('uploadedImagePaths', pathA);
    data.append('uploadedImagePaths', pathB);
    await expect(createProductAction(initial, data)).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'real-tenant',
        galleryUrls: ['https://example.test/' + pathA, 'https://example.test/' + pathB],
      }),
    );
  });
});

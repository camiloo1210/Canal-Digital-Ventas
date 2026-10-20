import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from 'next-intl';
import es from '@/messages/es.json';
import {
  createProductAction,
  updateProductAction,
} from '@/features/products/actions/products.actions';
import { InvalidWholesaleRulesException } from '@/products/domain/exceptions/invalid-wholesale-rules.exception';
import { OptimisticConcurrencyException } from '@/shared/application/exceptions/optimistic-concurrency.exception';

const mocks = vi.hoisted(
  (): {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    upload: ReturnType<typeof vi.fn>;
    user: ReturnType<typeof vi.fn>;
    tenant: ReturnType<typeof vi.fn>;
  } => ({ create: vi.fn(), update: vi.fn(), upload: vi.fn(), user: vi.fn(), tenant: vi.fn() }),
);
vi.mock('next-intl/server', (): object => ({
  getTranslations: async (): Promise<ReturnType<typeof createTranslator>> =>
    createTranslator({ locale: 'es', messages: es.CatalogForms }),
}));
vi.mock('@/features/products/di/products.di', (): object => ({
  getCreateProductUseCase: (): object => ({ execute: mocks.create }),
  getUpdateProductUseCase: (): object => ({ execute: mocks.update }),
  getStorageAdapter: (): object => ({ uploadImage: mocks.upload }),
}));
vi.mock('@/lib/supabase/server', (): object => ({
  createClient: async (): Promise<object> => ({ auth: { getUser: mocks.user } }),
}));
vi.mock('@/features/iam/queries/active-tenant.query', (): object => ({
  getActiveTenantQuery: mocks.tenant,
}));
vi.mock('next/cache', (): object => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', (): object => ({
  redirect: (): never => {
    throw new Error('NEXT_REDIRECT');
  },
}));

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
    mocks.upload.mockResolvedValue('https://example.test/product.png');
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
  it('rejects forged binary fields and oversized files before storage or mutations', async (): Promise<void> => {
    const data = form();
    data.set('image', 'fake-file');
    expect((await createProductAction(initial, data)).fieldErrors?.image).toBeDefined();
    data.set(
      'image',
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'too-big.png', { type: 'image/png' }),
    );
    expect((await createProductAction(initial, data)).fieldErrors?.image?.[0]).toContain('5 MB');
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('delivers a replacement image through primitives in the same product update', async (): Promise<void> => {
    const data = form();
    const file = new File(['image'], 'untrusted-name.png', { type: 'image/png' });
    data.set('image', file);
    await expect(updateProductAction(initial, data)).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.upload).toHaveBeenCalledWith(
      expect.any(File),
      expect.stringMatching(/^real-tenant\/[a-f0-9-]+\.png$/),
    );
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        imageUrl: 'https://example.test/product.png',
        imagePath: 'https://example.test/product.png',
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
});

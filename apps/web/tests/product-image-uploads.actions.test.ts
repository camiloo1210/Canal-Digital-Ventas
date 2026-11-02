import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from 'next-intl';
import es from '@/messages/es.json';
import { createProductImageUploadsAction } from '@/features/products/actions/product-image-uploads.actions';

const mocks = vi.hoisted(
  (): {
    sign: ReturnType<typeof vi.fn>;
    user: ReturnType<typeof vi.fn>;
    tenant: ReturnType<typeof vi.fn>;
  } => ({ sign: vi.fn(), user: vi.fn(), tenant: vi.fn() }),
);
vi.mock('next-intl/server', (): object => ({
  getTranslations: async (): Promise<ReturnType<typeof createTranslator>> =>
    createTranslator({ locale: 'es', messages: es.CatalogForms }),
}));
vi.mock('@/features/products/di/products.di', (): object => ({
  getStorageAdapter: (): object => ({ createSignedUpload: mocks.sign }),
}));
vi.mock('@/lib/supabase/server', (): object => ({
  createClient: async (): Promise<object> => ({ auth: { getUser: mocks.user } }),
}));
vi.mock('@/features/iam/queries/active-tenant.query', (): object => ({
  getActiveTenantQuery: mocks.tenant,
}));

describe('createProductImageUploadsAction', (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation((): void => undefined);
    mocks.user.mockResolvedValue({ data: { user: { id: 'actor' } } });
    mocks.tenant.mockResolvedValue('real-tenant');
    mocks.sign.mockImplementation(
      async (path: string): Promise<{ path: string; token: string }> => ({
        path,
        token: 'token-for-' + path,
      }),
    );
  });
  it('rejects anonymous callers before touching storage', async (): Promise<void> => {
    mocks.user.mockResolvedValue({ data: { user: null } });
    const result = await createProductImageUploadsAction({ contentTypes: ['image/png'] });
    expect(result).toMatchObject({ success: false, errorCode: 'UNAUTHORIZED' });
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it('derives keys from the session tenant and passes tokens through', async (): Promise<void> => {
    const result = await createProductImageUploadsAction({
      contentTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });
    expect(mocks.tenant).toHaveBeenCalledWith('actor');
    if (!result.success) throw new Error('expected success');
    expect(result.uploads).toHaveLength(3);
    const patterns = [/\.jpg$/, /\.png$/, /\.webp$/];
    result.uploads.forEach((upload, index): void => {
      expect(upload.path).toMatch(/^real-tenant\/[0-9a-f-]{36}\./);
      expect(upload.path).toMatch(patterns[index]);
      expect(upload.token).toBe('token-for-' + upload.path);
    });
    expect(new Set(result.uploads.map((upload): string => upload.path)).size).toBe(3);
  });
  it('ignores any client supplied tenant or path', async (): Promise<void> => {
    const result = await createProductImageUploadsAction({
      contentTypes: ['image/png'],
      tenantId: 'attacker',
      path: 'attacker/x.png',
    } as { contentTypes: string[] });
    if (!result.success) throw new Error('expected success');
    expect(result.uploads[0].path.startsWith('real-tenant/')).toBe(true);
  });
  it.each([
    ['empty list', []],
    ['unsupported mime', ['image/gif']],
    ['more than 8 items', Array.from({ length: 9 }, (): string => 'image/png')],
  ])('returns INVALID_INPUT for %s', async (_name, contentTypes): Promise<void> => {
    const result = await createProductImageUploadsAction({ contentTypes });
    expect(result).toMatchObject({ success: false, errorCode: 'INVALID_INPUT' });
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it('masks storage failures as UNEXPECTED', async (): Promise<void> => {
    mocks.sign.mockRejectedValue(new Error('secret vendor detail'));
    const result = await createProductImageUploadsAction({ contentTypes: ['image/png'] });
    expect(result).toMatchObject({ success: false, errorCode: 'UNEXPECTED' });
    expect(JSON.stringify(result)).not.toContain('secret');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateStoreSettingsAction } from '@/features/store-settings/actions/store-settings.actions';
import {
  getStoreSettingsReadRepository,
  getUpdateStoreSettingsUseCase,
} from '@/features/store-settings/di/store-settings.di';
import { createClient } from '@/lib/supabase/server';
import { getActiveTenantQuery } from '@/features/iam/queries/active-tenant.query';
import { revalidatePath } from 'next/cache';
import {
  TenantSlugAlreadyInUseException,
  type TenantBrandingReadModel,
} from '@canaldigital/packages/core';

vi.mock('next-intl/server', (): object => ({
  getTranslations: vi.fn().mockResolvedValue((key: string): string => key),
}));
vi.mock('next/cache', (): object => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', (): object => ({ createClient: vi.fn() }));
vi.mock('@/features/iam/queries/active-tenant.query', (): object => ({
  getActiveTenantQuery: vi.fn(),
}));
vi.mock('@/features/store-settings/di/store-settings.di', (): object => ({
  getStoreSettingsReadRepository: vi.fn(),
  getUpdateStoreSettingsUseCase: vi.fn(),
  getStoreBrandingStorage: vi.fn(),
}));

const actor = crypto.randomUUID();
const tenantId = crypto.randomUUID();
const execute = vi.fn();
const current: TenantBrandingReadModel = {
  name: 'Original store',
  slug: 'original-store',
  description: '',
  logoUrl: null,
  bannerUrl: null,
  version: 2,
};

function form(): FormData {
  const data = new FormData();
  data.set('name', 'New store');
  data.set('slug', 'new-store');
  data.set('description', 'Description');
  data.set('version', '2');
  return data;
}

describe('store URL changes', (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
    execute.mockReset().mockResolvedValue(undefined);
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: actor } } }) },
    } as unknown as Awaited<ReturnType<typeof createClient>>);
    vi.mocked(getActiveTenantQuery).mockResolvedValue(
      tenantId as Awaited<ReturnType<typeof getActiveTenantQuery>>,
    );
    vi.mocked(getStoreSettingsReadRepository).mockReturnValue({
      findForManager: vi.fn().mockResolvedValue(current),
    });
    vi.mocked(getUpdateStoreSettingsUseCase).mockReturnValue({ execute } as unknown as ReturnType<
      typeof getUpdateStoreSettingsUseCase
    >);
  });

  it('updates the trusted tenant and invalidates the old URL, new URL and dashboard navigation', async (): Promise<void> => {
    const data = form();
    data.set('tenantId', crypto.randomUUID());
    data.set('userId', crypto.randomUUID());
    const result = await updateStoreSettingsAction({ success: false, message: null }, data);
    expect(result.success).toBe(true);
    expect(result.saved?.slug).toBe('new-store');
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: actor,
        tenantId,
        name: 'New store',
        slug: 'new-store',
        version: 2,
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith('/store/original-store', 'layout');
    expect(revalidatePath).toHaveBeenCalledWith('/store/new-store', 'layout');
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard', 'layout');
  });

  it('returns a localized collision message and retains the submitted name and slug', async (): Promise<void> => {
    execute.mockRejectedValue(new TenantSlugAlreadyInUseException());
    const result = await updateStoreSettingsAction({ success: false, message: null }, form());
    expect(result).toMatchObject({
      success: false,
      message: 'slugTaken',
      values: { name: 'New store', slug: 'new-store' },
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each(['name', 'slug', 'description'])(
    'rejects a file submitted as the text field %s',
    async (field: string): Promise<void> => {
      const data = form();
      data.set(field, new File(['payload'], 'input.txt', { type: 'text/plain' }));
      const result = await updateStoreSettingsAction({ success: false, message: null }, data);
      expect(result).toMatchObject({ success: false, message: 'invalidInput' });
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it.each([null, '', '-1', '1.5', '9007199254740992'])(
    'rejects a missing or invalid version %s',
    async (version: string | null): Promise<void> => {
      const data = form();
      if (version === null) data.delete('version');
      else data.set('version', version);
      const result = await updateStoreSettingsAction({ success: false, message: null }, data);
      expect(result).toMatchObject({ success: false, message: 'invalidInput' });
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it('reports a successful commit even if cache invalidation fails afterward', async (): Promise<void> => {
    const log = vi.spyOn(console, 'error').mockImplementation((): void => undefined);
    vi.mocked(revalidatePath).mockImplementationOnce((): never => {
      throw new Error('Cache unavailable');
    });
    try {
      const result = await updateStoreSettingsAction({ success: false, message: null }, form());
      expect(result).toMatchObject({ success: true, saved: { version: 3, slug: 'new-store' } });
      expect(execute).toHaveBeenCalledOnce();
    } finally {
      log.mockRestore();
    }
  });
});

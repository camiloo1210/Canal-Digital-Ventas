import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveShippingOriginAction } from '@/features/store-settings/actions/shipping-origin.actions';
import { getSaveShippingOriginUseCase } from '@/features/store-settings/di/store-settings.di';
import { createClient } from '@/lib/supabase/server';
import { resolveActiveTenantQuery } from '@/features/iam/queries/active-tenant.query';
import { userHasAnyPermission } from '@/features/users/queries/member-permissions.query';
import { revalidatePath } from 'next/cache';
import { ShippingOriginForbiddenException } from '@canaldigital/packages/core';

vi.mock('@/features/users/queries/member-permissions.query', (): object => ({
  userHasAnyPermission: vi.fn(async (): Promise<boolean> => true),
}));
vi.mock('next-intl/server', (): object => ({
  getTranslations: vi.fn().mockResolvedValue((key: string): string => key),
}));
vi.mock('next/cache', (): object => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', (): object => ({ createClient: vi.fn() }));
vi.mock('@/features/iam/queries/active-tenant.query', (): object => ({
  resolveActiveTenantQuery: vi.fn(),
}));
vi.mock('@/features/store-settings/di/store-settings.di', (): object => ({
  getSaveShippingOriginUseCase: vi.fn(),
}));

const actor = crypto.randomUUID();
const tenantId = crypto.randomUUID();
const execute = vi.fn();
const initial = { success: false, message: null };

function form(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  const fields: Record<string, string> = {
    contactName: 'Ana Gomez',
    phone: '3001234567',
    street: 'Calle 1 # 2-3',
    city: 'Bogota',
    state: 'DC',
    zipCode: '110111',
    country: 'CO',
    tenantId,
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('saveShippingOriginAction', (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
    execute.mockReset().mockResolvedValue(undefined);
    vi.mocked(userHasAnyPermission).mockResolvedValue(true);
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: actor } } }) },
    } as unknown as Awaited<ReturnType<typeof createClient>>);
    vi.mocked(resolveActiveTenantQuery).mockImplementation(
      async (
        _user: string,
        id: string,
      ): Promise<Awaited<ReturnType<typeof resolveActiveTenantQuery>>> =>
        id === tenantId
          ? { status: 'ready', tenantId, tenantName: 'S', tenantSlug: 's', role: 'OWNER' }
          : null,
    );
    vi.mocked(getSaveShippingOriginUseCase).mockReturnValue({ execute } as unknown as ReturnType<
      typeof getSaveShippingOriginUseCase
    >);
  });

  it('saves with the server-resolved actor and tenant', async (): Promise<void> => {
    const data = form();
    data.set('authenticatedUserId', crypto.randomUUID());
    const result = await saveShippingOriginAction(initial, data);
    expect(result.success).toBe(true);
    expect(execute).toHaveBeenCalledWith({
      tenantId,
      authenticatedUserId: actor,
      contactName: 'Ana Gomez',
      phone: '3001234567',
      street: 'Calle 1 # 2-3',
      city: 'Bogota',
      state: 'DC',
      zipCode: '110111',
      country: 'CO',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/store');
  });

  it('returns a localized error and keeps the values on invalid input', async (): Promise<void> => {
    const result = await saveShippingOriginAction(initial, form({ street: '', country: 'col' }));
    expect(result).toMatchObject({
      success: false,
      message: 'invalidInput',
      values: { street: '', country: 'col', city: 'Bogota' },
    });
    expect(result.fieldErrors?.street).toEqual(['validation.street']);
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects a user without the manage permission', async (): Promise<void> => {
    vi.mocked(userHasAnyPermission).mockResolvedValue(false);
    const result = await saveShippingOriginAction(initial, form());
    expect(result).toMatchObject({ success: false, message: 'unauthorized' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects a tenant the user does not belong to', async (): Promise<void> => {
    const result = await saveShippingOriginAction(initial, form({ tenantId: crypto.randomUUID() }));
    expect(result).toMatchObject({ success: false, message: 'contextChanged' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('maps a forbidden use case result and keeps values', async (): Promise<void> => {
    execute.mockRejectedValue(new ShippingOriginForbiddenException());
    const result = await saveShippingOriginAction(initial, form());
    expect(result).toMatchObject({
      success: false,
      message: 'unauthorized',
      values: { city: 'Bogota' },
    });
  });

  it('masks unexpected errors', async (): Promise<void> => {
    execute.mockRejectedValue(new Error('db down'));
    const result = await saveShippingOriginAction(initial, form());
    expect(result).toMatchObject({ success: false, message: 'unexpected' });
  });
});

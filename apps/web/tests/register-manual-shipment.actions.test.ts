import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerManualShipmentAction } from '@/features/orders/actions/register-manual-shipment.actions';
import { createClient } from '@/lib/supabase/server';
import { resolveActionTenant } from '@/features/dashboard/server/resolve-action-tenant';
import { ordersDi } from '@/features/orders/di/orders.di';
import { userHasAnyPermission } from '@/features/users/queries/member-permissions.query';
import { InvalidOrderAttributeException } from '@canaldigital/packages/core';

vi.mock('next-intl/server', (): object => ({
  getTranslations:
    async (): Promise<(key: string) => string> =>
    (key: string): string =>
      key,
}));
vi.mock('next/cache', (): object => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', (): object => ({ createClient: vi.fn() }));
vi.mock('@/features/dashboard/server/resolve-action-tenant', (): object => ({
  resolveActionTenant: vi.fn(),
}));
vi.mock('@/features/users/queries/member-permissions.query', (): object => ({
  userHasAnyPermission: vi.fn(),
}));
vi.mock('@/features/orders/di/orders.di', (): object => ({
  ordersDi: { resolveRegisterManualShipmentUseCase: vi.fn() },
}));
const actor = crypto.randomUUID();
const tenantId = crypto.randomUUID();
const orderId = crypto.randomUUID();
const execute = vi.fn();
function data(): FormData {
  const form = new FormData();
  form.set('tenantId', tenantId);
  form.set('orderId', orderId);
  form.set('version', '0');
  form.set('carrier', 'Carrier');
  form.set('trackingNumber', 'ABC');
  return form;
}
describe('manual shipment action', (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
    execute.mockReset().mockResolvedValue(undefined);
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: actor } } }) },
    } as unknown as Awaited<ReturnType<typeof createClient>>);
    vi.mocked(resolveActionTenant).mockResolvedValue({ tenantId, tenantSlug: 'store' } as Awaited<
      ReturnType<typeof resolveActionTenant>
    >);
    vi.mocked(userHasAnyPermission).mockResolvedValue(true);
    vi.mocked(ordersDi.resolveRegisterManualShipmentUseCase).mockReturnValue({
      execute,
    } as unknown as ReturnType<typeof ordersDi.resolveRegisterManualShipmentUseCase>);
  });
  it('injects actor and verified tenant', async (): Promise<void> => {
    const result = await registerManualShipmentAction(
      { success: false, message: '', values: { carrier: '', trackingNumber: '' } },
      data(),
    );
    expect(result.success).toBe(true);
    expect(execute).toHaveBeenCalledWith({
      orderId,
      tenantId,
      authenticatedSellerId: actor,
      expectedShipmentVersion: 0,
      carrier: 'Carrier',
      trackingNumber: 'ABC',
    });
  });
  it('explains invalid shipment data without losing input', async (): Promise<void> => {
    execute.mockRejectedValue(new InvalidOrderAttributeException('private'));
    const result = await registerManualShipmentAction(
      { success: false, message: '', values: { carrier: '', trackingNumber: '' } },
      data(),
    );
    expect(result.message).toBe('shipment.invalid');
    expect(result.values).toEqual({ carrier: 'Carrier', trackingNumber: 'ABC' });
  });
  it('retains entered data when the seller is unauthorized', async (): Promise<void> => {
    vi.mocked(userHasAnyPermission).mockResolvedValue(false);
    const result = await registerManualShipmentAction(
      { success: false, message: '', values: { carrier: '', trackingNumber: '' } },
      data(),
    );
    expect(result.success).toBe(false);
    expect(result.values).toEqual({ carrier: 'Carrier', trackingNumber: 'ABC' });
    expect(execute).not.toHaveBeenCalled();
  });
});

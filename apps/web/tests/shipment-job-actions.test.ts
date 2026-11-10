import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ShipmentLabelUnavailableException,
  ShipmentNotRetryableException,
  ShipmentRetryNotAllowedException,
  OrderNotFoundException,
} from '@canaldigital/packages/core';
import { retryShipmentAction } from '@/features/orders/actions/retry-shipment.actions';
import { downloadLabelAction } from '@/features/orders/actions/label-download.actions';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  tenant: vi.fn(),
  permitted: vi.fn(),
  retryExecute: vi.fn(),
  labelExecute: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock('next-intl/server', () => ({
  getTranslations:
    async () =>
    (key: string): string =>
      key,
}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async (): Promise<object> => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock('@/features/dashboard/server/resolve-action-tenant', () => ({
  resolveActionTenant: mocks.tenant,
}));
vi.mock('@/features/users/queries/member-permissions.query', () => ({
  userHasAnyPermission: mocks.permitted,
}));
vi.mock('@/features/orders/di/orders.di', () => ({
  ordersDi: {
    resolveRetryShipmentUseCase: (): object => ({ execute: mocks.retryExecute }),
    resolveGetLabelUrlUseCase: async (): Promise<object> => ({ execute: mocks.labelExecute }),
  },
}));

const actor = crypto.randomUUID();
const tenant = crypto.randomUUID();
const order = crypto.randomUUID();
const initial = { success: false, message: '' };

function form(orderId: string = order): FormData {
  const data = new FormData();
  data.set('orderId', orderId);
  data.set('tenantId', crypto.randomUUID());
  data.set('actorId', crypto.randomUUID());
  return data;
}

beforeEach((): void => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: actor } } });
  mocks.tenant.mockResolvedValue({ tenantId: tenant });
  mocks.permitted.mockResolvedValue(true);
  mocks.retryExecute.mockResolvedValue(undefined);
  mocks.labelExecute.mockResolvedValue('https://signed.example/label');
});

describe('retryShipmentAction', (): void => {
  it('injects the authenticated actor and verified tenant, never client ids', async (): Promise<void> => {
    const result = await retryShipmentAction(initial, form());
    expect(result.success).toBe(true);
    expect(mocks.retryExecute).toHaveBeenCalledWith({
      orderId: order,
      tenantId: tenant,
      authenticatedSellerId: actor,
    });
    expect(mocks.revalidate).toHaveBeenCalledWith('/dashboard/orders');
  });
  it('rejects anonymous users, invalid ids and sellers without MANAGE_ORDERS', async (): Promise<void> => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    expect((await retryShipmentAction(initial, form())).success).toBe(false);
    mocks.getUser.mockResolvedValue({ data: { user: { id: actor } } });
    expect((await retryShipmentAction(initial, form('nope'))).success).toBe(false);
    mocks.permitted.mockResolvedValue(false);
    expect((await retryShipmentAction(initial, form())).success).toBe(false);
    expect(mocks.retryExecute).not.toHaveBeenCalled();
  });
  it.each([
    [new OrderNotFoundException(), 'action.orderNotFound'],
    [new ShipmentNotRetryableException(), 'action.notRetryable'],
    [new ShipmentRetryNotAllowedException(), 'action.trackingExists'],
    [new Error('db password leaked'), 'action.failed'],
  ])('maps %s to a localized safe message', async (error, message): Promise<void> => {
    mocks.retryExecute.mockRejectedValue(error);
    expect(await retryShipmentAction(initial, form())).toEqual({ success: false, message });
  });
});

describe('downloadLabelAction', (): void => {
  it('returns a short-lived url for an authorized manager', async (): Promise<void> => {
    const result = await downloadLabelAction(initial, form());
    expect(result).toEqual({ success: true, url: 'https://signed.example/label', message: '' });
    expect(mocks.labelExecute).toHaveBeenCalledWith({
      orderId: order,
      tenantId: tenant,
      authenticatedSellerId: actor,
    });
  });
  it('does not call the use case without permission', async (): Promise<void> => {
    mocks.permitted.mockResolvedValue(false);
    expect((await downloadLabelAction(initial, form())).success).toBe(false);
    expect(mocks.labelExecute).not.toHaveBeenCalled();
  });
  it('masks unexpected errors and reports missing labels', async (): Promise<void> => {
    mocks.labelExecute.mockRejectedValue(new ShipmentLabelUnavailableException());
    expect((await downloadLabelAction(initial, form())).message).toBe('action.labelUnavailable');
    mocks.labelExecute.mockRejectedValue(new Error('storage path leaked'));
    const masked = await downloadLabelAction(initial, form());
    expect(masked).toEqual({ success: false, message: 'action.failed' });
  });
});

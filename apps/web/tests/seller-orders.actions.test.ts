import { beforeEach, describe, expect, it, vi } from 'vitest';
import { changeOrderStatusAction } from '@/features/orders/actions/change-order-status.actions';
import { ordersDi } from '@/features/orders/di/orders.di';
import { createClient } from '@/lib/supabase/server';
import { getActiveTenantQuery } from '@/features/iam/queries/active-tenant.query';
import { revalidatePath } from 'next/cache';
import {
  OrderNotFoundException,
  InvalidOrderStateException,
  OptimisticConcurrencyException,
} from '@canaldigital/packages/core';

vi.mock('next-intl/server', (): object => ({
  getTranslations: vi.fn().mockResolvedValue((key: string): string => key),
}));
vi.mock('next/cache', (): object => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', (): object => ({ createClient: vi.fn() }));
vi.mock('@/features/iam/queries/active-tenant.query', (): object => ({
  getActiveTenantQuery: vi.fn(),
}));
vi.mock('@/features/orders/di/orders.di', (): object => ({
  ordersDi: { resolveChangeOrderStatusUseCase: vi.fn() },
}));

const actor = crypto.randomUUID();
const tenantId = crypto.randomUUID();
const orderId = crypto.randomUUID();
const execute = vi.fn().mockResolvedValue(undefined);

function form(): FormData {
  const data = new FormData();
  data.set('orderId', orderId);
  data.set('status', 'processing');
  data.set('expectedVersion', '4');
  return data;
}

function authenticate(userId: string | null): void {
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: userId ? { id: userId } : null } }),
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
}

describe('seller order status action security', (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
    execute.mockReset().mockResolvedValue(undefined);
    authenticate(actor);
    vi.mocked(getActiveTenantQuery).mockResolvedValue(
      tenantId as Awaited<ReturnType<typeof getActiveTenantQuery>>,
    );
    vi.mocked(ordersDi.resolveChangeOrderStatusUseCase).mockReturnValue({
      execute,
    } as unknown as ReturnType<typeof ordersDi.resolveChangeOrderStatusUseCase>);
  });

  it('rejects unauthenticated requests', async (): Promise<void> => {
    authenticate(null);
    const result = await changeOrderStatusAction({ success: false, errorCode: null }, form());
    expect(result.errorCode).toBe('UNAUTHORIZED');
    expect(execute).not.toHaveBeenCalled();
  });

  it('injects actor and tenant from the session and ignores client identities', async (): Promise<void> => {
    const data = form();
    data.set('tenantId', crypto.randomUUID());
    data.set('authenticatedSellerId', crypto.randomUUID());
    const result = await changeOrderStatusAction({ success: false, errorCode: null }, data);
    expect(result.success).toBe(true);
    expect(execute).toHaveBeenCalledWith({
      orderId,
      status: 'processing',
      expectedVersion: 4,
      tenantId,
      authenticatedSellerId: actor,
    });
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/orders');
    expect(revalidatePath).toHaveBeenCalledWith('/');
  });

  it.each([
    ['status', 'paid'],
    ['status', 'cancelled'],
    ['expectedVersion', '-1'],
    ['expectedVersion', '1.5'],
    ['expectedVersion', '999999999999999999'],
    ['orderId', 'invalid'],
  ])('rejects malformed or non-logistics input %s=%s', async (name, value): Promise<void> => {
    const data = form();
    data.set(name, value);
    expect(
      (await changeOrderStatusAction({ success: false, errorCode: null }, data)).errorCode,
    ).toBe('INVALID_INPUT');
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects requests without a trusted active tenant', async (): Promise<void> => {
    vi.mocked(getActiveTenantQuery).mockResolvedValue(null);
    expect(
      (await changeOrderStatusAction({ success: false, errorCode: null }, form())).errorCode,
    ).toBe('NOT_FOUND');
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([
    [new OrderNotFoundException(), 'NOT_FOUND'],
    [new InvalidOrderStateException('Private state detail'), 'INVALID_STATE'],
    [new OptimisticConcurrencyException('Order', orderId), 'CONCURRENCY'],
    [new Error('Private database credentials'), 'UNEXPECTED'],
  ])('maps typed errors without leaking internal messages', async (error, code): Promise<void> => {
    execute.mockRejectedValue(error);
    const result = await changeOrderStatusAction({ success: false, errorCode: null }, form());
    expect(result.errorCode).toBe(code);
    expect(result.message).toBe(`errors.${code}`);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

import { test, expect, vi, describe, beforeEach } from 'vitest';
import { cancelOrderAction } from '@/features/orders/actions/cancel-order.actions';
import { ordersDi } from '@/features/orders/di/orders.di';
import * as supabaseServer from '@/lib/supabase/server';

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string): string => key),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/features/orders/di/orders.di', () => ({
  ordersDi: {
    resolveCancelOrderUseCase: vi.fn(),
    resolveBuyerOrderReadRepository: vi.fn(),
  },
}));

describe('cancelOrderAction Security & Error Mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should reject unauthenticated buyer with UNAUTHORIZED', async () => {
    vi.mocked(supabaseServer.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
        }),
      },
    } as unknown as Awaited<ReturnType<typeof supabaseServer.createClient>>);

    const formData = new FormData();
    formData.append('orderId', '550e8400-e29b-41d4-a716-446655440000');

    const result = await cancelOrderAction({ success: false, errorCode: null }, formData);

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('UNAUTHORIZED');
    expect(ordersDi.resolveCancelOrderUseCase).not.toHaveBeenCalled();
  });

  test('should reject invalid orderId format with INVALID_INPUT', async () => {
    vi.mocked(supabaseServer.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'buyer-auth-uuid' } },
        }),
      },
    } as unknown as Awaited<ReturnType<typeof supabaseServer.createClient>>);

    const formData = new FormData();
    formData.append('orderId', 'not-a-uuid');

    const result = await cancelOrderAction({ success: false, errorCode: null }, formData);

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('INVALID_INPUT');
    expect(ordersDi.resolveCancelOrderUseCase).not.toHaveBeenCalled();
  });

  test('should execute use case with authenticated user ID and return success', async () => {
    vi.mocked(supabaseServer.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'buyer-auth-uuid' } },
        }),
      },
    } as unknown as Awaited<ReturnType<typeof supabaseServer.createClient>>);

    const mockExecute = vi.fn().mockResolvedValue(undefined);
    vi.mocked(ordersDi.resolveCancelOrderUseCase).mockReturnValue({
      execute: mockExecute,
    } as unknown as ReturnType<typeof ordersDi.resolveCancelOrderUseCase>);

    const formData = new FormData();
    const validOrderId = '550e8400-e29b-41d4-a716-446655440000';
    formData.append('orderId', validOrderId);

    const result = await cancelOrderAction({ success: false, errorCode: null }, formData);

    expect(result.success).toBe(true);
    expect(result.errorCode).toBeNull();
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockExecute).toHaveBeenCalledWith({
      orderId: validOrderId,
      authenticatedBuyerId: 'buyer-auth-uuid',
    });
  });

  test('should map OrderNotFoundException to ORDER_NOT_FOUND', async () => {
    vi.mocked(supabaseServer.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'buyer-auth-uuid' } },
        }),
      },
    } as unknown as Awaited<ReturnType<typeof supabaseServer.createClient>>);

    class OrderNotFoundException extends Error {
      constructor() {
        super('Order not found');
        this.name = 'OrderNotFoundException';
      }
    }

    const mockExecute = vi.fn().mockRejectedValue(new OrderNotFoundException());
    vi.mocked(ordersDi.resolveCancelOrderUseCase).mockReturnValue({
      execute: mockExecute,
    } as unknown as ReturnType<typeof ordersDi.resolveCancelOrderUseCase>);

    const formData = new FormData();
    formData.append('orderId', '550e8400-e29b-41d4-a716-446655440000');

    const result = await cancelOrderAction({ success: false, errorCode: null }, formData);

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('ORDER_NOT_FOUND');
  });

  test('should map InvalidOrderStateException to INVALID_ORDER_STATE', async () => {
    vi.mocked(supabaseServer.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'buyer-auth-uuid' } },
        }),
      },
    } as unknown as Awaited<ReturnType<typeof supabaseServer.createClient>>);

    class InvalidOrderStateException extends Error {
      constructor() {
        super('Cannot cancel order in state');
        this.name = 'InvalidOrderStateException';
      }
    }

    const mockExecute = vi.fn().mockRejectedValue(new InvalidOrderStateException());
    vi.mocked(ordersDi.resolveCancelOrderUseCase).mockReturnValue({
      execute: mockExecute,
    } as unknown as ReturnType<typeof ordersDi.resolveCancelOrderUseCase>);

    const formData = new FormData();
    formData.append('orderId', '550e8400-e29b-41d4-a716-446655440000');

    const result = await cancelOrderAction({ success: false, errorCode: null }, formData);

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('INVALID_ORDER_STATE');
  });

  test('should map OptimisticConcurrencyException to CONCURRENCY_ERROR', async () => {
    vi.mocked(supabaseServer.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'buyer-auth-uuid' } },
        }),
      },
    } as unknown as Awaited<ReturnType<typeof supabaseServer.createClient>>);

    class OptimisticConcurrencyException extends Error {
      constructor() {
        super('Concurrent update detected');
        this.name = 'OptimisticConcurrencyException';
      }
    }

    const mockExecute = vi.fn().mockRejectedValue(new OptimisticConcurrencyException());
    vi.mocked(ordersDi.resolveCancelOrderUseCase).mockReturnValue({
      execute: mockExecute,
    } as unknown as ReturnType<typeof ordersDi.resolveCancelOrderUseCase>);

    const formData = new FormData();
    formData.append('orderId', '550e8400-e29b-41d4-a716-446655440000');

    const result = await cancelOrderAction({ success: false, errorCode: null }, formData);

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('CONCURRENCY_ERROR');
  });
});

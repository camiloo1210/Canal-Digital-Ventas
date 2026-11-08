import { describe, it, expect, vi } from 'vitest';
import { HandlePaymentOrderEventUseCase } from '@/orders/application/use-cases/handle-payment-order-event.use-case';
import type { MarkOrderPaidUseCase } from '@/orders/application/use-cases/mark-order-paid.use-case';
import type { CancelExpiredOrderUseCase } from '@/orders/application/use-cases/cancel-expired-order.use-case';
import type { ApplyObservedRefundToOrderUseCase } from '@/orders/application/use-cases/apply-observed-refund-to-order.use-case';
import { PermanentMessageException } from '@/shared/application/exceptions/permanent-message.exception';
import type { IntegrationEvent } from '@/shared/application/ports/out/integration-event-publisher.port';

type Result = 'APPLIED' | 'NOOP' | 'MISMATCH' | 'EXCLUDED';
interface Collaborator {
  execute: ReturnType<typeof vi.fn<(dto: unknown) => Promise<Result>>>;
}

function collaborator(result: Result = 'APPLIED'): Collaborator {
  return { execute: vi.fn<(dto: unknown) => Promise<Result>>().mockResolvedValue(result) };
}

function buildEvent(overrides: Partial<IntegrationEvent> = {}): IntegrationEvent {
  return {
    messageId: 'message-1',
    tenantId: 'tenant-1',
    aggregateType: 'Payment',
    aggregateId: 'payment-1',
    eventType: 'sales.payment.completed',
    occurredAt: '2026-01-15T12:00:00.000Z',
    payload: { paymentId: 'payment-1', orderId: 'order-1', tenantId: 'tenant-1' },
    ...overrides,
  };
}

function setup(results: { paid?: Result; expired?: Result; refunded?: Result } = {}): {
  paid: Collaborator;
  expired: Collaborator;
  refunded: Collaborator;
  useCase: HandlePaymentOrderEventUseCase;
} {
  const paid = collaborator(results.paid);
  const expired = collaborator(results.expired);
  const refunded = collaborator(results.refunded);
  const useCase = new HandlePaymentOrderEventUseCase(
    paid as unknown as MarkOrderPaidUseCase,
    expired as unknown as CancelExpiredOrderUseCase,
    refunded as unknown as ApplyObservedRefundToOrderUseCase,
  );
  return { paid, expired, refunded, useCase };
}

const expectedDto = { paymentId: 'payment-1', orderId: 'order-1', tenantId: 'tenant-1' };

describe('HandlePaymentOrderEventUseCase', () => {
  describe('routing', () => {
    it.each([
      ['sales.payment.completed', 'paid'],
      ['sales.payment.checkout_expired', 'expired'],
      ['sales.payment.late_payment', 'expired'],
      ['sales.payment.refund_observed', 'refunded'],
    ] as const)(
      '%s calls only the %s collaborator, exactly once, with the correlated ids',
      async (eventType, target): Promise<void> => {
        const parts = setup();

        await parts.useCase.execute(buildEvent({ eventType }));

        for (const name of ['paid', 'expired', 'refunded'] as const) {
          expect(parts[name].execute).toHaveBeenCalledTimes(name === target ? 1 : 0);
        }
        expect(parts[target].execute).toHaveBeenCalledWith(expectedDto);
      },
    );

    it('treats NOOP as a successful, idempotent redelivery', async (): Promise<void> => {
      const { useCase } = setup({ paid: 'NOOP' });
      await expect(useCase.execute(buildEvent())).resolves.toBeUndefined();
    });

    it('rejects an unknown event type as a permanent failure and calls nothing', async (): Promise<void> => {
      const parts = setup();

      await expect(
        parts.useCase.execute(buildEvent({ eventType: 'sales.payment.exploded' })),
      ).rejects.toThrow(PermanentMessageException);

      expect(parts.paid.execute).not.toHaveBeenCalled();
      expect(parts.expired.execute).not.toHaveBeenCalled();
      expect(parts.refunded.execute).not.toHaveBeenCalled();
    });
  });

  describe('correlation guard (permanent, never retried)', () => {
    it.each([
      ['wrong aggregate type', { aggregateType: 'Order' }],
      ['aggregateId differs from paymentId', { aggregateId: 'payment-2' }],
      ['event tenant differs from payload tenant', { tenantId: 'tenant-2' }],
      ['missing paymentId', { payload: { orderId: 'order-1', tenantId: 'tenant-1' } }],
      [
        'non-string orderId',
        { payload: { paymentId: 'payment-1', orderId: 7, tenantId: 'tenant-1' } },
      ],
      ['payload tenant missing', { payload: { paymentId: 'payment-1', orderId: 'order-1' } }],
    ] as const)('%s', async (_label, overrides): Promise<void> => {
      const parts = setup();

      await expect(parts.useCase.execute(buildEvent({ ...overrides }))).rejects.toThrow(
        PermanentMessageException,
      );

      expect(parts.paid.execute).not.toHaveBeenCalled();
      expect(parts.expired.execute).not.toHaveBeenCalled();
      expect(parts.refunded.execute).not.toHaveBeenCalled();
    });
  });

  describe('results that need a human', () => {
    it.each([
      ['sales.payment.completed', { paid: 'MISMATCH' }],
      ['sales.payment.completed', { paid: 'EXCLUDED' }],
      ['sales.payment.checkout_expired', { expired: 'MISMATCH' }],
      ['sales.payment.late_payment', { expired: 'EXCLUDED' }],
      ['sales.payment.refund_observed', { refunded: 'MISMATCH' }],
    ] as const)(
      '%s with %j throws a permanent exception',
      async (eventType, results): Promise<void> => {
        const { useCase } = setup(results);
        await expect(useCase.execute(buildEvent({ eventType }))).rejects.toThrow(
          PermanentMessageException,
        );
      },
    );
  });

  describe('collaborator failures propagate so the queue retries', () => {
    it.each([
      ['sales.payment.completed', 'paid'],
      ['sales.payment.checkout_expired', 'expired'],
      ['sales.payment.refund_observed', 'refunded'],
    ] as const)('%s', async (eventType, target): Promise<void> => {
      const parts = setup();
      const failure = new Error('database unavailable');
      parts[target].execute.mockRejectedValueOnce(failure);

      const outcome = parts.useCase.execute(buildEvent({ eventType }));

      await expect(outcome).rejects.toBe(failure);
      await expect(outcome).rejects.not.toBeInstanceOf(PermanentMessageException);
    });
  });
});

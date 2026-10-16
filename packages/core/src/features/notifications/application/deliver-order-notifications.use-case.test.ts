import { describe, expect, it, vi } from 'vitest';
import { DeliverOrderNotificationsUseCase } from '@/notifications/application/deliver-order-notifications.use-case';
import type { IntegrationEvent } from '@/shared/application/ports/out/integration-event-publisher.port';
import { NotificationPermanentException } from '@/notifications/application/exceptions/notification-permanent.exception';

const event: IntegrationEvent = {
  messageId: 'event-1',
  tenantId: 'tenant-1',
  aggregateId: 'order-1',
  aggregateType: 'Order',
  eventType: 'OrderPaidEvent',
  occurredAt: '2026-10-16T00:00:00Z',
  payload: { orderId: 'order-1' },
};

describe('independent buyer and owner delivery', (): void => {
  it('still delivers to the owner if the buyer is permanently rejected', async (): Promise<void> => {
    const owner = vi.fn(async (): Promise<'SENT'> => 'SENT');
    const useCase = new DeliverOrderNotificationsUseCase([
      {
        execute: async (): Promise<never> => {
          throw new NotificationPermanentException('SMTP_RECIPIENT_REJECTED');
        },
      },
      { execute: owner },
    ]);
    expect(await useCase.execute(event, 1)).toBe('DEAD');
    expect(owner).toHaveBeenCalledOnce();
  });
  it('processes the other audience before retrying a transient error', async (): Promise<void> => {
    const owner = vi.fn(async (): Promise<'SENT'> => 'SENT');
    const useCase = new DeliverOrderNotificationsUseCase([
      {
        execute: async (): Promise<never> => {
          throw new Error('temporary SMTP failure');
        },
      },
      { execute: owner },
    ]);
    await expect(useCase.execute(event, 1)).rejects.toThrow('temporary SMTP failure');
    expect(owner).toHaveBeenCalledOnce();
  });
  it('retains busy deliveries for another queue attempt', async (): Promise<void> => {
    const useCase = new DeliverOrderNotificationsUseCase([
      { execute: async (): Promise<'BUSY'> => 'BUSY' },
      { execute: async (): Promise<'SENT'> => 'SENT' },
    ]);
    expect(await useCase.execute(event, 1)).toBe('BUSY');
  });
  it('does not dead-letter an unfinished audience when another audience is already dead', async (): Promise<void> => {
    const useCase = new DeliverOrderNotificationsUseCase([
      { execute: async (): Promise<'DEAD'> => 'DEAD' },
      { execute: async (): Promise<'BUSY'> => 'BUSY' },
    ]);
    expect(await useCase.execute(event, 2)).toBe('BUSY');
  });
});

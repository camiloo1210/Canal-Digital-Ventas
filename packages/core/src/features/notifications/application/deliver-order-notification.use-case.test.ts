import { describe, expect, it } from 'vitest';
import { DeliverOrderNotificationUseCase } from '@/notifications/application/deliver-order-notification.use-case';
import type { IntegrationEvent } from '@/shared/application/ports/out/integration-event-publisher.port';
import type {
  DeliveryClaim,
  NotificationDeliveryPort,
  NotificationEmail,
} from '@/notifications/application/ports/out/notification.ports';
import { NotificationPermanentException } from '@/notifications/application/exceptions/notification-permanent.exception';

const event: IntegrationEvent = {
  messageId: 'event-1',
  tenantId: 'tenant-1',
  aggregateType: 'Order',
  aggregateId: 'order-1',
  eventType: 'OrderConfirmedEvent',
  occurredAt: '2026-10-15T00:00:00Z',
  payload: { orderId: 'order-1' },
};
class Deliveries implements NotificationDeliveryPort {
  public state: DeliveryClaim = 'CLAIMED';
  public completed = false;
  public terminal: boolean | undefined;
  public async claim(): Promise<DeliveryClaim> {
    return this.state;
  }
  public async complete(): Promise<void> {
    this.completed = true;
  }
  public async fail(_id: string, terminal: boolean): Promise<void> {
    this.terminal = terminal;
  }
}
describe('DeliverOrderNotificationUseCase', (): void => {
  it('uses tenant-scoped trusted recipient data and completes only after SMTP delivery', async (): Promise<void> => {
    const deliveries = new Deliveries();
    let email: NotificationEmail | undefined;
    const useCase = new DeliverOrderNotificationUseCase(
      deliveries,
      {
        findRecipient: async (
          tenant: string,
          order: string,
        ): Promise<{ email: string; orderNumber: string; tenantName: string }> => {
          expect([tenant, order]).toEqual(['tenant-1', 'order-1']);
          return { email: 'buyer@example.test', orderNumber: 'ORD-1', tenantName: 'Store' };
        },
      },
      {
        send: async (value: NotificationEmail): Promise<void> => {
          expect(deliveries.completed).toBe(false);
          email = value;
        },
      },
      'es',
    );
    expect(await useCase.execute(event, 1)).toBe('SENT');
    expect(email).toMatchObject({
      messageId: 'event-1',
      email: 'buyer@example.test',
      type: 'confirmed',
      locale: 'es',
    });
    expect(deliveries.completed).toBe(true);
  });
  it('does not send duplicates or notifications for unsupported events', async (): Promise<void> => {
    const deliveries = new Deliveries();
    deliveries.state = 'SENT';
    let sends = 0;
    const useCase = new DeliverOrderNotificationUseCase(
      deliveries,
      { findRecipient: async (): Promise<null> => null },
      {
        send: async (): Promise<void> => {
          sends++;
        },
      },
      'es',
    );
    expect(await useCase.execute(event, 1)).toBe('DUPLICATE');
    await expect(
      useCase.execute({ ...event, eventType: 'ProductCreatedEvent' }, 1),
    ).rejects.toBeInstanceOf(NotificationPermanentException);
    expect(sends).toBe(0);
  });
  it('makes missing recipients terminal without mailing another tenant', async (): Promise<void> => {
    const deliveries = new Deliveries();
    const useCase = new DeliverOrderNotificationUseCase(
      deliveries,
      { findRecipient: async (): Promise<null> => null },
      { send: async (): Promise<void> => {} },
      'en',
    );
    await expect(useCase.execute(event, 1)).rejects.toBeInstanceOf(NotificationPermanentException);
    expect(deliveries.terminal).toBe(true);
  });
  it.each([1, 5])(
    'retries transient SMTP errors and stops after attempt %i',
    async (attempt: number): Promise<void> => {
      const deliveries = new Deliveries();
      const useCase = new DeliverOrderNotificationUseCase(
        deliveries,
        {
          findRecipient: async (): Promise<{
            email: string;
            orderNumber: string;
            tenantName: string;
          }> => ({ email: 'buyer@example.test', orderNumber: 'ORD-1', tenantName: 'Store' }),
        },
        {
          send: async (): Promise<void> => {
            throw new Error('unavailable');
          },
        },
        'es',
      );
      await expect(useCase.execute(event, attempt)).rejects.toThrow('unavailable');
      expect(deliveries.terminal).toBe(attempt === 5);
      expect(deliveries.completed).toBe(false);
    },
  );
});

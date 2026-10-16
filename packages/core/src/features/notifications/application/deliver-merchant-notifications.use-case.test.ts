import { describe, expect, it, vi } from 'vitest';
import { DeliverMerchantNotificationsUseCase } from '@/notifications/application/deliver-merchant-notifications.use-case';
import type {
  MerchantDeliveryKey,
  MerchantNotificationEmail,
  MerchantOrderRecipient,
} from '@/notifications/application/ports/out/merchant-notification.ports';
import type { DeliveryClaim } from '@/notifications/application/ports/out/notification.ports';
import type { IntegrationEvent } from '@/shared/application/ports/out/integration-event-publisher.port';
import { NotificationPermanentException } from '@/notifications/application/exceptions/notification-permanent.exception';

const event: IntegrationEvent = {
  messageId: 'event-1',
  tenantId: 'tenant-1',
  aggregateId: 'order-1',
  aggregateType: 'Order',
  eventType: 'OrderConfirmedEvent',
  occurredAt: '2026-10-16T00:00:00Z',
  payload: { orderId: 'order-1' },
};
const recipient: MerchantOrderRecipient = {
  userId: 'owner-1',
  email: 'owner@example.test',
  orderNumber: 'ORD-1',
  tenantName: 'Store',
  stockItems: [0, 10, 11].map((stock: number): MerchantOrderRecipient['stockItems'][number] => ({
    productId: `product-${stock}`,
    name: `Product ${stock}`,
    sku: `SKU-${stock}`,
    stock,
  })),
};

function setup(owners: MerchantOrderRecipient[] = [recipient]): {
  useCase: DeliverMerchantNotificationsUseCase;
  sent: MerchantNotificationEmail[];
  states: Map<string, DeliveryClaim>;
  fail: ReturnType<typeof vi.fn>;
} {
  const states = new Map<string, DeliveryClaim>();
  const sent: MerchantNotificationEmail[] = [];
  const keyOf = (key: MerchantDeliveryKey): string => `${key.messageId}/${key.userId}/${key.kind}`;
  const fail = vi.fn(async (key: MerchantDeliveryKey, terminal: boolean): Promise<void> => {
    states.set(keyOf(key), terminal ? 'DEAD' : 'CLAIMED');
  });
  const useCase = new DeliverMerchantNotificationsUseCase(
    {
      findRecipients: async (
        messageId: string,
        tenantId: string,
        orderId: string,
        eventType: string,
      ): Promise<MerchantOrderRecipient[]> => {
        expect([messageId, tenantId, orderId, eventType]).toEqual([
          event.messageId,
          event.tenantId,
          event.aggregateId,
          expect.any(String),
        ]);
        return owners;
      },
    },
    {
      claim: async (key: MerchantDeliveryKey): Promise<DeliveryClaim> =>
        states.get(keyOf(key)) ?? 'CLAIMED',
      complete: async (key: MerchantDeliveryKey): Promise<void> => {
        states.set(keyOf(key), 'SENT');
      },
      fail,
    },
    {
      sendMerchant: async (email: MerchantNotificationEmail): Promise<void> => {
        sent.push(email);
      },
    },
    'es',
  );
  return { useCase, sent, states, fail };
}

describe('merchant order notifications', (): void => {
  it('sends a new-order notice and includes stock 0 and 10, excluding 11', async (): Promise<void> => {
    const { useCase, sent } = setup();
    expect(await useCase.execute(event, 1)).toBe('SENT');
    expect(sent.map((email: MerchantNotificationEmail): string => email.kind)).toEqual([
      'new_order',
      'low_stock',
    ]);
    expect(
      sent[1].stockItems.map(
        (item: MerchantOrderRecipient['stockItems'][number]): number => item.stock,
      ),
    ).toEqual([0, 10]);
    expect(
      sent.every((email: MerchantNotificationEmail): boolean => email.email === recipient.email),
    ).toBe(true);
  });
  it('does not resend completed notices on duplicate queue delivery', async (): Promise<void> => {
    const { useCase, sent } = setup();
    await useCase.execute(event, 1);
    await useCase.execute(event, 2);
    expect(sent).toHaveLength(2);
  });
  it('tracks each owner independently', async (): Promise<void> => {
    const { useCase, sent, states } = setup([
      recipient,
      { ...recipient, userId: 'owner-2', email: 'owner2@example.test' },
    ]);
    states.set('event-1/owner-1/new_order', 'SENT');
    states.set('event-1/owner-1/low_stock', 'SENT');
    await useCase.execute(event, 1);
    expect(sent).toHaveLength(2);
    expect(
      sent.every((email: MerchantNotificationEmail): boolean => email.userId === 'owner-2'),
    ).toBe(true);
  });
  it.each([
    ['OrderPaidEvent', 'paid'],
    ['OrderCancelledEvent', 'cancelled'],
  ])(
    'sends %s without a repeated stock alert',
    async (eventType: string, kind: string): Promise<void> => {
      const { useCase, sent } = setup();
      await useCase.execute({ ...event, eventType }, 1);
      expect(sent).toHaveLength(1);
      expect(sent[0].kind).toBe(kind);
    },
  );
  it('waits for another delivery lease instead of sending twice', async (): Promise<void> => {
    const { useCase, sent, states } = setup();
    states.set('event-1/owner-1/new_order', 'BUSY');
    states.set('event-1/owner-1/low_stock', 'SENT');
    expect(await useCase.execute(event, 1)).toBe('BUSY');
    expect(sent).toHaveLength(0);
  });
  it('does not guess an owner when the read model has no active owners', async (): Promise<void> => {
    const { useCase, sent } = setup([]);
    await useCase.execute(event, 1);
    expect(sent).toHaveLength(0);
  });
  it('rejects a mismatched order before looking up recipients', async (): Promise<void> => {
    await expect(
      setup().useCase.execute({ ...event, payload: { orderId: 'another-order' } }, 1),
    ).rejects.toBeInstanceOf(NotificationPermanentException);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { DeliverKiviOrderNotificationUseCase } from '@/kivi/application/use-cases/deliver-kivi-order-notification.use-case';
import type { IntegrationEvent } from '@/shared/application/ports/out/integration-event-publisher.port';
import { KiviGatewayException } from '@/kivi/application/exceptions/kivi-gateway.exception';

const event: IntegrationEvent = {
  messageId: crypto.randomUUID(),
  tenantId: crypto.randomUUID(),
  aggregateId: crypto.randomUUID(),
  aggregateType: 'Order',
  eventType: 'OrderShippedEvent',
  occurredAt: new Date().toISOString(),
  payload: {},
};
event.payload.orderId = event.aggregateId;
describe('Kivi order notifications', (): void => {
  it('skips stores without a connection', async (): Promise<void> => {
    const deliver = vi.fn();
    await expect(
      new DeliverKiviOrderNotificationUseCase(
        { find: async (): Promise<null> => null },
        { deliver },
      ).execute(event),
    ).resolves.toBe('SENT');
    expect(deliver).not.toHaveBeenCalled();
  });
  it('rejects forged order identity before reading credentials', async (): Promise<void> => {
    const find = vi.fn();
    await expect(
      new DeliverKiviOrderNotificationUseCase({ find }, { deliver: vi.fn() }).execute({
        ...event,
        payload: { orderId: crypto.randomUUID() },
      }),
    ).rejects.toThrow();
    expect(find).not.toHaveBeenCalled();
  });
  it('keeps the event id stable across retry and propagates failures to RabbitMQ', async (): Promise<void> => {
    const source = {
      target: {
        baseUrl: 'https://api.kivi.example',
        connectionId: crypto.randomUUID(),
        token: 'secret',
      },
      phone: '+593999999999',
      orderNumber: 'ORD-1',
    };
    const deliver = vi
      .fn()
      .mockRejectedValueOnce(new KiviGatewayException('transient', 503))
      .mockResolvedValue(undefined);
    const useCase = new DeliverKiviOrderNotificationUseCase(
      { find: async (): Promise<typeof source> => source },
      { deliver },
    );
    await expect(useCase.execute(event)).rejects.toMatchObject({
      failure: 'transient',
      status: 503,
    });
    await expect(useCase.execute(event)).resolves.toBe('SENT');
    expect(deliver.mock.calls.map((call): unknown => call[1].messageId)).toEqual([
      event.messageId,
      event.messageId,
    ]);
  });
});

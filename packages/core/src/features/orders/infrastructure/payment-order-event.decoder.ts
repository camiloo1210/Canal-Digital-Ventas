import type { IntegrationEvent } from '@/shared/application/ports/out/integration-event-publisher.port';
import type { JsonObject } from '@/shared/domain/types/json.type';
import { PermanentMessageException } from '@/shared/application/exceptions/permanent-message.exception';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function decodePaymentOrderEvent(body: string): IntegrationEvent {
  try {
    const value: unknown = JSON.parse(body);
    if (!isRecord(value) || !isRecord(value.payload))
      throw new PermanentMessageException('Invalid payment message.');
    const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
    for (const key of ['messageId', 'tenantId', 'aggregateId']) {
      if (typeof value[key] !== 'string' || !uuid.test(value[key]))
        throw new PermanentMessageException('Invalid payment message identity.');
    }
    if (
      value.aggregateType !== 'Payment' ||
      typeof value.eventType !== 'string' ||
      ![
        'sales.payment.completed',
        'sales.payment.checkout_expired',
        'sales.payment.refund_observed',
        'sales.payment.late_payment',
      ].includes(value.eventType) ||
      typeof value.occurredAt !== 'string' ||
      !Number.isFinite(Date.parse(value.occurredAt)) ||
      typeof value.payload.orderId !== 'string' ||
      !uuid.test(value.payload.orderId)
    )
      throw new PermanentMessageException('Invalid payment message type.');
    return {
      messageId: value.messageId as string,
      tenantId: value.tenantId as string,
      aggregateId: value.aggregateId as string,
      aggregateType: 'Payment',
      eventType: value.eventType,
      occurredAt: value.occurredAt,
      payload: value.payload as JsonObject,
    };
  } catch (error: unknown) {
    if (error instanceof PermanentMessageException) throw error;
    throw new PermanentMessageException('Malformed payment message.');
  }
}

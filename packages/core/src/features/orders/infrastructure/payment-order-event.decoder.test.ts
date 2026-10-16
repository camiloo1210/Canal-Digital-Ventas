import { describe, expect, it } from 'vitest';
import { decodePaymentOrderEvent } from '@/orders/infrastructure/payment-order-event.decoder';
import { PermanentMessageException } from '@/shared/application/exceptions/permanent-message.exception';

const id = '11111111-1111-4111-8111-111111111111';
const event = {
  messageId: id,
  tenantId: id,
  aggregateId: id,
  aggregateType: 'Payment',
  eventType: 'sales.payment.completed',
  occurredAt: '2026-10-15T00:00:00Z',
  payload: { orderId: id, paymentId: id, tenantId: id },
};
describe('payment order message decoding', (): void => {
  it('preserves the validated wire event', (): void => {
    expect(decodePaymentOrderEvent(JSON.stringify(event))).toEqual(event);
  });
  it.each([
    '{',
    'null',
    '[]',
    JSON.stringify({ ...event, aggregateType: 'Order' }),
    JSON.stringify({ ...event, payload: { orderId: 'invalid' } }),
    JSON.stringify({ ...event, eventType: 'OrderPaidEvent' }),
  ])('rejects malformed or unrouted payload %s', (body: string): void => {
    expect((): unknown => decodePaymentOrderEvent(body)).toThrow(PermanentMessageException);
  });
});

import type { IntegrationEvent } from '@/shared/application/ports/out/integration-event-publisher.port';
import { PermanentMessageException } from '@/shared/application/exceptions/permanent-message.exception';
import type { MarkOrderPaidUseCase } from '@/orders/application/use-cases/mark-order-paid.use-case';
import type { CancelExpiredOrderUseCase } from '@/orders/application/use-cases/cancel-expired-order.use-case';
import type { ApplyObservedRefundToOrderUseCase } from '@/orders/application/use-cases/apply-observed-refund-to-order.use-case';

export class HandlePaymentOrderEventUseCase {
  public constructor(
    private readonly paid: MarkOrderPaidUseCase,
    private readonly expired: CancelExpiredOrderUseCase,
    private readonly refunded: ApplyObservedRefundToOrderUseCase,
  ) {}

  public async execute(event: IntegrationEvent): Promise<void> {
    const { paymentId, orderId, tenantId } = event.payload;
    if (
      event.aggregateType !== 'Payment' ||
      typeof paymentId !== 'string' ||
      paymentId !== event.aggregateId ||
      typeof orderId !== 'string' ||
      tenantId !== event.tenantId
    ) {
      throw new PermanentMessageException('Invalid payment order event correlation.');
    }
    const dto = { paymentId, orderId, tenantId: event.tenantId };
    let result: string;
    if (event.eventType === 'sales.payment.completed') result = await this.paid.execute(dto);
    else if (
      event.eventType === 'sales.payment.checkout_expired' ||
      event.eventType === 'sales.payment.late_payment'
    )
      result = await this.expired.execute(dto);
    else if (event.eventType === 'sales.payment.refund_observed')
      result = await this.refunded.execute(dto);
    else throw new PermanentMessageException('Unsupported payment domain event.');
    if (result === 'MISMATCH' || result === 'EXCLUDED')
      throw new PermanentMessageException('Payment domain event requires manual review.');
  }
}

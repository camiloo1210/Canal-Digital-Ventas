import { PaymentGatewayFactoryPort } from '@/payments/application/ports/out/payment-gateway-factory.port';
import { PaymentRepositoryPort } from '@/payments/application/ports/out/payment-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { ProcessWebhookDto } from '@/payments/application/dtos/process-webhook.dto';
import { PaymentNotFoundException } from '@/payments/application/exceptions/payment-not-found.exception';
import { PaymentId } from '@/payments/domain/types/payment-id.type';
import { PaymentStatus } from '@/payments/domain/enums/payment-status.enum';

export class ProcessPaymentWebhookUseCase {
  constructor(
    private readonly paymentRepository: PaymentRepositoryPort,
    private readonly paymentGatewayFactory: PaymentGatewayFactoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(dto: ProcessWebhookDto): Promise<{ alreadyProcessed: boolean }> {
    const gatewayPort = this.paymentGatewayFactory.getGateway(dto.gateway);

    const webhookResult = await gatewayPort.processWebhook(dto.payload, dto.signature);

    const paymentId = webhookResult.paymentId;
    const payment = await this.paymentRepository.findById(paymentId, dto.tenantId);

    if (!payment) {
      throw new PaymentNotFoundException(paymentId);
    }

    if (payment.getGatewayTransactionId() === webhookResult.eventId) {
      return { alreadyProcessed: true };
    }

    if (webhookResult.status === PaymentStatus.COMPLETED) {
      payment.markAsCompleted(webhookResult.eventId);
    } else if (webhookResult.status === PaymentStatus.FAILED) {
      payment.markAsFailed(webhookResult.failureReason || 'Webhook reported failure');
    } else if (webhookResult.status === PaymentStatus.REFUNDED) {
      payment.refund();
    }

    await this.paymentRepository.save(payment);

    await this.eventBus.publish(payment.domainEvents);
    payment.clearDomainEvents();

    return { alreadyProcessed: false };
  }
}

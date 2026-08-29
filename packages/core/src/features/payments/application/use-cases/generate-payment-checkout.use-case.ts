import { PaymentGatewayFactoryPort } from '@/payments/application/ports/out/payment-gateway-factory.port';
import { PaymentRepositoryPort } from '@/payments/application/ports/out/payment-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { GenerateCheckoutDto } from '@/payments/application/dtos/generate-checkout.dto';
import { Payment } from '@/payments/domain/entities/payment.entity';
import { PaymentId } from '@/payments/domain/types/payment-id.type';
import { Money } from '@/shared/domain/value-objects/money.vo';
import * as crypto from 'crypto';

export class GeneratePaymentCheckoutUseCase {
  constructor(
    private readonly paymentRepository: PaymentRepositoryPort,
    private readonly paymentGatewayFactory: PaymentGatewayFactoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(dto: GenerateCheckoutDto): Promise<string> {
    const paymentId = crypto.randomUUID() as PaymentId;
    const amountMoney = Money.from(dto.amount, 'USD');

    // 1. Instanciar la entidad de dominio Payment (PENDING)
    const payment = Payment.create(
      paymentId,
      dto.orderId,
      dto.tenantId,
      dto.customerId,
      dto.gateway,
      amountMoney,
    );

    // 2. Obtener el gateway dinámico usando la fábrica (Strategy)
    const gatewayPort = this.paymentGatewayFactory.getGateway(dto.gateway);

    // 3. Generar la URL de checkout
    const checkoutUrl = await gatewayPort.createCheckoutSession(payment);

    // 4. Persistir el pago
    await this.paymentRepository.save(payment);

    // 5. Publicar eventos de dominio (PaymentCreatedEvent)
    await this.eventBus.publish(payment.domainEvents);
    payment.clearDomainEvents();

    return checkoutUrl;
  }
}

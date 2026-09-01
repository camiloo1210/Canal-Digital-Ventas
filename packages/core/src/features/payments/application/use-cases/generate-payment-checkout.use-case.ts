import { PaymentGatewayFactoryPort } from '@/payments/application/ports/out/payment-gateway-factory.port';
import { PaymentRepositoryPort } from '@/payments/application/ports/out/payment-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { GenerateCheckoutDto } from '@/payments/application/dtos/generate-checkout.dto';
import { Payment } from '@/payments/domain/entities/payment.entity';
import { createPaymentId } from '@/payments/domain/types/payment-id.type';
import { createOrderId } from '@/payments/domain/types/order-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { createCustomerId } from '@/payments/domain/types/customer-id.type';
import { parsePaymentGateway } from '@/payments/domain/enums/payment-gateway.enum';
import { Money } from '@/shared/domain/value-objects/money.vo';
import { Currency } from '@/shared/domain/enums/currency.enum';
import * as crypto from 'crypto';

export class GeneratePaymentCheckoutUseCase {
  constructor(
    private readonly paymentRepository: PaymentRepositoryPort,
    private readonly paymentGatewayFactory: PaymentGatewayFactoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(dto: GenerateCheckoutDto): Promise<string> {
    const paymentId = createPaymentId(crypto.randomUUID());
    const orderId = createOrderId(dto.orderId);
    const tenantId = createTenantId(dto.tenantId);
    const customerId = createCustomerId(dto.customerId);
    const gateway = parsePaymentGateway(dto.gateway);
    const amountMoney = Money.from(dto.amount, Currency.USD);

    const payment = Payment.create(paymentId, orderId, tenantId, customerId, gateway, amountMoney);

    const gatewayPort = this.paymentGatewayFactory.getGateway(gateway);

    const checkoutUrl = await gatewayPort.createCheckoutSession(payment);

    await this.paymentRepository.save(payment);

    await this.eventBus.publish(payment.domainEvents);
    payment.clearDomainEvents();

    return checkoutUrl;
  }
}

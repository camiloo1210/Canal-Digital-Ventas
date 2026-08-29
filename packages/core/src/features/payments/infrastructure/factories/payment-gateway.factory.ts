import { PaymentGatewayFactoryPort } from '@/payments/application/ports/out/payment-gateway-factory.port';
import { PaymentGatewayPort } from '@/payments/application/ports/out/payment-gateway.port';
import { PaymentGateway } from '@/payments/domain/enums/payment-gateway.enum';
import { UnsupportedPaymentGatewayException } from '@/payments/application/exceptions/unsupported-payment-gateway.exception';

export class PaymentGatewayFactory implements PaymentGatewayFactoryPort {
  constructor(
    private readonly lemonSqueezyAdapter: PaymentGatewayPort,
    private readonly manualAdapter: PaymentGatewayPort,
    // future adapters like stripeAdapter can be injected here
  ) {}

  getGateway(gateway: PaymentGateway): PaymentGatewayPort {
    switch (gateway) {
      case PaymentGateway.LEMON_SQUEEZY:
        return this.lemonSqueezyAdapter;
      case PaymentGateway.MANUAL:
        return this.manualAdapter;
      default:
        throw new UnsupportedPaymentGatewayException(gateway);
    }
  }
}

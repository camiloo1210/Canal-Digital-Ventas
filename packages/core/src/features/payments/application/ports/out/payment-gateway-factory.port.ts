import { PaymentGateway } from '@/payments/domain/enums/payment-gateway.enum';
import { PaymentGatewayPort } from '@/payments/application/ports/out/payment-gateway.port';

export interface PaymentGatewayFactoryPort {
  getGateway(gateway: PaymentGateway): PaymentGatewayPort;
}

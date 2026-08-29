import { PaymentGateway } from '@/payments/domain/enums/payment-gateway.enum';
import { CustomerId } from '@/payments/domain/types/customer-id.type';
import { OrderId } from '@/payments/domain/types/order-id.type';
import { TenantId } from '@/payments/domain/types/tenant-id.type';

export interface GenerateCheckoutDto {
  orderId: OrderId;
  tenantId: TenantId;
  customerId: CustomerId;
  gateway: PaymentGateway;
  amount: number;
}

import { OrderId } from '@/orders/domain/types/order-id.type';
import { TenantId } from '@/orders/domain/types/tenant-id.type';
import { PaymentGatewayId } from '@/orders/domain/types/payment-gateway-id.type';

export interface PayOrderDto {
  orderId: OrderId;
  tenantId: TenantId;
  paymentGatewayId: PaymentGatewayId;
}

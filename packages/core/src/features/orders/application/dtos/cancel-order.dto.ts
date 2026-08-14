import { OrderId } from '@/orders/domain/types/order-id.type';
import { TenantId } from '@/orders/domain/types/tenant-id.type';

export interface CancelOrderDto {
  orderId: OrderId;
  tenantId: TenantId;
}

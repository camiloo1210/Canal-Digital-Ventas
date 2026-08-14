import { OrderId } from '@/orders/domain/types/order-id.type';
import { TenantId } from '@/orders/domain/types/tenant-id.type';
import { OrderStatus } from '@/orders/domain/enums/order-status.enum';

export interface ChangeOrderStatusDto {
  orderId: OrderId;
  tenantId: TenantId;
  status: OrderStatus;
}

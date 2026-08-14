import { PaginationOptions } from '@/shared/domain/pagination/pagination';
import { OrderId } from '@/orders/domain/types/order-id.type';
import { TenantId } from '@/orders/domain/types/tenant-id.type';
import { OrderStatus } from '@/orders/domain/enums/order-status.enum';

export interface SearchOrdersDto {
  id?: OrderId;
  status?: OrderStatus[];
  tenantId: TenantId;
  pagination?: PaginationOptions;
}

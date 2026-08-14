import { Order } from '@/orders/domain/entities/order.entity';
import { PaginatedResult, PaginationOptions } from '@/shared/domain/pagination/pagination';
import { OrderId } from '@/orders/domain/types/order-id.type';
import { CustomerId } from '@/orders/domain/types/customer-id.type';
import { TenantId } from '@/orders/domain/types/tenant-id.type';
import { OrderStatus } from '@/orders/domain/enums/order-status.enum';

export interface OrderFilters {
  id?: OrderId;
  status?: OrderStatus[];
  tenantId: TenantId;
}

export interface OrderRepositoryPort {
  save(order: Order): Promise<void>;

  findById(id: OrderId, tenantId: TenantId): Promise<Order | null>;

  findPendingByCustomerId(customerId: CustomerId, tenantId: TenantId): Promise<Order | null>;

  findAll(tenantId: TenantId, pagination?: PaginationOptions): Promise<PaginatedResult<Order>>;

  searchByFilters(
    filters: OrderFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Order>>;
}

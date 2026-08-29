import { Payment } from '@/payments/domain/entities/payment.entity';
import { PaymentId } from '@/payments/domain/types/payment-id.type';
import { TenantId } from '@/payments/domain/types/tenant-id.type';
import { PaymentStatus } from '@/payments/domain/enums/payment-status.enum';
import { PaginatedResult, PaginationOptions } from '@/shared/domain/pagination/pagination';

export interface PaymentFilters {
  id?: PaymentId;
  status?: PaymentStatus[];
  tenantId: TenantId;
}

export interface PaymentRepositoryPort {
  save(payment: Payment): Promise<void>;

  findById(id: PaymentId, tenantId: TenantId): Promise<Payment | null>;

  findAll(tenantId: TenantId, pagination?: PaginationOptions): Promise<PaginatedResult<Payment>>;

  searchByFilters(
    filters: PaymentFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Payment>>;
}

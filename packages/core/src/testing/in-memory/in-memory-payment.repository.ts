import { Payment } from '@/payments/domain/entities/payment.entity';
import type { PaymentId } from '@/payments/domain/types/payment-id.type';
import type { TenantId } from '@/shared/domain/types/tenant-id.type';
import type {
  PaymentFilters,
  PaymentRepositoryPort,
} from '@/payments/application/ports/out/payment-repository.port';
import type { PaginatedResult, PaginationOptions } from '@/shared/domain/pagination/pagination';

function paginate<T>(items: T[], pagination?: PaginationOptions): PaginatedResult<T> {
  if (!pagination) {
    return { items, totalItems: items.length, totalPages: 1, currentPage: 1 };
  }
  const start = (pagination.page - 1) * pagination.limit;
  return {
    items: items.slice(start, start + pagination.limit),
    totalItems: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / pagination.limit)),
    currentPage: pagination.page,
  };
}

/** Tenant-scoped in-memory payments; `save` keeps the saved instance, `saveCount` counts saves. */
export class InMemoryPaymentRepository implements PaymentRepositoryPort {
  private readonly store = new Map<string, Payment>();
  public saveCount = 0;

  private static key(tenantId: string, id: string): string {
    return `${tenantId}::${id}`;
  }

  private inTenant(tenantId: TenantId): Payment[] {
    return [...this.store.values()].filter(
      (payment): boolean => payment.getTenantId() === tenantId,
    );
  }

  async save(payment: Payment): Promise<void> {
    this.saveCount++;
    this.store.set(InMemoryPaymentRepository.key(payment.getTenantId(), payment.getId()), payment);
  }

  async findById(id: PaymentId, tenantId: TenantId): Promise<Payment | null> {
    return this.store.get(InMemoryPaymentRepository.key(tenantId, id)) ?? null;
  }

  async findAll(
    tenantId: TenantId,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Payment>> {
    return paginate(this.inTenant(tenantId), pagination);
  }

  async searchByFilters(
    filters: PaymentFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Payment>> {
    const matches = this.inTenant(filters.tenantId).filter(
      (payment): boolean =>
        (filters.id === undefined || payment.getId() === filters.id) &&
        (filters.status === undefined || filters.status.includes(payment.getStatus())),
    );
    return paginate(matches, pagination);
  }
}

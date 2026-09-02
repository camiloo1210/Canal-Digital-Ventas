import { SupabaseClient } from '@supabase/supabase-js';
import {
  PaymentRepositoryPort,
  PaymentFilters,
} from '@/payments/application/ports/out/payment-repository.port';
import { Payment } from '@/payments/domain/entities/payment.entity';
import { PaymentId } from '@/payments/domain/types/payment-id.type';
import { TenantId } from '@/shared/domain/types/tenant-id.type';
import { PaginatedResult, PaginationOptions } from '@/shared/domain/pagination/pagination';
import { PaymentRepositoryException } from '@/payments/infrastructure/exceptions/payment-repository.exception';
import { DbPaymentRow } from '@/payments/infrastructure/types/supabase-payment.types';
import { PaymentMapper } from '@/payments/infrastructure/mappers/payment.mapper';

export class SupabasePaymentRepository implements PaymentRepositoryPort {
  constructor(private readonly supabase: SupabaseClient) {}

  async save(payment: Payment): Promise<void> {
    const row = PaymentMapper.toPersistence(payment);

    const { error: paymentError } = await this.supabase.rpc('upsert_payment_transactional', {
      payment_data: row,
    });

    if (paymentError) {
      if (paymentError.code === 'P0001') {
        throw new PaymentRepositoryException(
          'Optimistic locking failure: The payment was updated by another transaction.',
          paymentError,
        );
      }
      throw new PaymentRepositoryException(
        `Failed to save payment: ${paymentError.message}`,
        paymentError,
      );
    }
  }

  async findById(id: PaymentId, tenantId: TenantId): Promise<Payment | null> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not Found
      throw new PaymentRepositoryException(`Failed to find payment: ${error.message}`, error);
    }

    return PaymentMapper.toDomain(data as DbPaymentRow);
  }

  async findAll(
    tenantId: TenantId,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Payment>> {
    const limit = pagination?.limit || 10;
    const page = pagination?.page || 1;
    const offset = (page - 1) * limit;

    const { data, error, count } = await this.supabase
      .from('payments')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (error) {
      throw new PaymentRepositoryException(`Failed to find all payments: ${error.message}`, error);
    }

    const payments = (data as DbPaymentRow[]).map(PaymentMapper.toDomain);

    return {
      items: payments,
      totalItems: count || 0,
      totalPages: count ? Math.ceil(count / limit) : 0,
      currentPage: page,
    };
  }

  async searchByFilters(
    filters: PaymentFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Payment>> {
    const limit = pagination?.limit || 10;
    const page = pagination?.page || 1;
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('payments')
      .select('*', { count: 'exact' })
      .eq('tenant_id', filters.tenantId);

    if (filters.id) {
      query = query.eq('id', filters.id);
    }

    if (filters.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }

    const { data, error, count } = await query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (error) {
      throw new PaymentRepositoryException(`Failed to search payments: ${error.message}`, error);
    }

    const payments = (data as DbPaymentRow[]).map(PaymentMapper.toDomain);

    return {
      items: payments,
      totalItems: count || 0,
      totalPages: count ? Math.ceil(count / limit) : 0,
      currentPage: page,
    };
  }
}

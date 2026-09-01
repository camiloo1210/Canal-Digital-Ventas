import { SupabaseClient } from '@supabase/supabase-js';
import {
  CustomerRepositoryPort,
  CustomerFilters,
} from '@/customers/application/ports/out/customer-repository.port';
import { Customer } from '@/customers/domain/entities/customer.entity';
import { SupabaseCustomerMapper } from '@/customers/infrastructure/mappers/supabase-customer.mapper';
import { DbCustomerRow } from '@/customers/infrastructure/types/supabase-customer.types';
import { PaginationOptions, PaginatedResult } from '@/shared/domain/pagination/pagination';
import { CustomerId } from '@/customers/domain/types/customer-id.type';
import { TenantId } from '@/shared/domain/types/tenant-id.type';
import { CustomerRepositoryException } from '@/customers/infrastructure/exceptions/customer-repository.exception';

export class SupabaseCustomerRepository implements CustomerRepositoryPort {
  constructor(private readonly supabase: SupabaseClient) {}

  async save(customer: Customer): Promise<void> {
    const customerRow = SupabaseCustomerMapper.toPersistence(customer);

    const { error } = await this.supabase.rpc('upsert_customer_transactional', {
      customer_data: customerRow,
    });

    if (error) {
      if (error.code === 'P0001') {
        throw new CustomerRepositoryException(
          'Optimistic locking failure: The customer was updated by another transaction.',
          error,
        );
      }
      throw new CustomerRepositoryException(`Failed to save customer: ${error.message}`, error);
    }
  }

  async findById(id: CustomerId, tenantId: TenantId): Promise<Customer | null> {
    const { data, error } = await this.supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      if (error && error.code !== 'PGRST116') {
        throw new CustomerRepositoryException(
          `Database error searching customer: ${error.message}`,
        );
      }
      return null;
    }

    return SupabaseCustomerMapper.toDomain(data as DbCustomerRow);
  }

  async findByEmail(email: string, tenantId: TenantId): Promise<Customer | null> {
    const { data, error } = await this.supabase
      .from('customers')
      .select('*')
      .eq('email', email)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      if (error && error.code !== 'PGRST116') {
        throw new CustomerRepositoryException(
          `Database error searching customer by email: ${error.message}`,
        );
      }
      return null;
    }

    return SupabaseCustomerMapper.toDomain(data as DbCustomerRow);
  }

  async findAll(
    tenantId: TenantId,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Customer>> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await this.supabase
      .from('customers')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .range(from, to)
      .order('created_at', { ascending: false });

    if (error) {
      throw new CustomerRepositoryException(`Failed to get customers: ${error.message}`);
    }

    const totalItems = count ?? 0;
    const customers = (data ?? []).map((row: unknown) =>
      SupabaseCustomerMapper.toDomain(row as DbCustomerRow),
    );

    return {
      items: customers,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
    };
  }

  async searchByFilters(
    filters: CustomerFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Customer>> {
    let query = this.supabase
      .from('customers')
      .select('*', { count: 'exact' })
      .eq('tenant_id', filters.tenantId)
      .order('created_at', { ascending: false });

    if (filters.id) {
      query = query.eq('id', filters.id);
    }

    if (filters.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }

    if (filters.searchTerm) {
      query = query.or(
        `full_name.ilike.%${filters.searchTerm}%,email.ilike.%${filters.searchTerm}%`,
      );
    }

    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      throw new CustomerRepositoryException(`Failed to search customers: ${error.message}`);
    }

    const totalItems = count ?? 0;
    const customers = (data ?? []).map((row) =>
      SupabaseCustomerMapper.toDomain(row as DbCustomerRow),
    );

    return {
      items: customers,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
    };
  }
}

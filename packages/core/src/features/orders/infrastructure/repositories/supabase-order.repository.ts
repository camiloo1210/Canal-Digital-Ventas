import { SupabaseClient } from '@supabase/supabase-js';
import {
  OrderRepositoryPort,
  OrderFilters,
} from '@/orders/application/ports/out/order-repository.port';
import { Order } from '@/orders/domain/entities/order.entity';
import { SupabaseOrderMapper } from '@/orders/infrastructure/mappers/supabase-order.mapper';
import { DbOrderRow } from '@/orders/infrastructure/types/supabase-order.types';
import { PaginationOptions, PaginatedResult } from '@/shared/domain/pagination/pagination';
import { OrderId } from '@/orders/domain/types/order-id.type';
import { CustomerId } from '@/orders/domain/types/customer-id.type';
import { TenantId } from '@/shared/domain/types/tenant-id.type';
import { OrderRepositoryException } from '@/orders/infrastructure/exceptions/order-repository.exception';

export class SupabaseOrderRepository implements OrderRepositoryPort {
  constructor(private readonly supabase: SupabaseClient) {}

  async save(order: Order): Promise<void> {
    const { orderRow, orderItemsRows } = SupabaseOrderMapper.toPersistence(order);

    const { error } = await this.supabase.rpc('upsert_order_transactional', {
      order_data: orderRow,
      items_data: orderItemsRows,
    });

    if (error) {
      if (error.code === 'P0001') {
        throw new OrderRepositoryException(
          `Optimistic locking failed: the order has been updated by another transaction.`,
        );
      }
      throw new OrderRepositoryException(`Failed to save order transactionally: ${error.message}`);
    }
  }

  async findById(id: OrderId, tenantId: TenantId): Promise<Order | null> {
    const { data, error } = await this.supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      if (error && error.code !== 'PGRST116') {
        // PGRST116 = multiple or no rows returned
        throw new OrderRepositoryException(`Database error searching order: ${error.message}`);
      }
      return null;
    }

    return SupabaseOrderMapper.toDomain(data as DbOrderRow);
  }

  async findPendingByCustomerId(customerId: CustomerId, tenantId: TenantId): Promise<Order | null> {
    const { data, error } = await this.supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('customer_id', customerId)
      .eq('tenant_id', tenantId)
      .eq('status', 'draft') // Buscamos el carrito activo
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new OrderRepositoryException(`Database error searching active cart: ${error.message}`);
    }

    if (!data) return null;

    return SupabaseOrderMapper.toDomain(data as DbOrderRow);
  }

  async findAll(
    tenantId: TenantId,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Order>> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await this.supabase
      .from('orders')
      .select('*, order_items(*)', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .range(from, to)
      .order('created_at', { ascending: false });

    if (error) {
      throw new OrderRepositoryException(`Failed to get orders: ${error.message}`);
    }

    const totalItems = count ?? 0;
    const orders = (data ?? []).map((row: unknown) =>
      SupabaseOrderMapper.toDomain(row as DbOrderRow),
    );

    return {
      items: orders,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
    };
  }

  async searchByFilters(
    filters: OrderFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Order>> {
    let query = this.supabase
      .from('orders')
      .select('*, order_items(*)', { count: 'exact' })
      .eq('tenant_id', filters.tenantId)
      .order('created_at', { ascending: false });

    if (filters.id) {
      query = query.eq('id', filters.id);
    }

    if (filters.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }

    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      throw new OrderRepositoryException(`Failed to search orders: ${error.message}`);
    }

    const totalItems = count ?? 0;
    const orders = (data ?? []).map((row) => SupabaseOrderMapper.toDomain(row as DbOrderRow));

    return {
      items: orders,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
    };
  }
}

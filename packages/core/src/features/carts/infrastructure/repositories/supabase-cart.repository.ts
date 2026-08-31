import { SupabaseClient } from '@supabase/supabase-js';
import { CartRepositoryPort } from '@/carts/application/ports/out/cart-repository.port';
import { Cart } from '@/carts/domain/entities/cart.entity';
import { SupabaseCartMapper } from '@/carts/infrastructure/mappers/supabase-cart.mapper';
import { DbCartRow } from '@/carts/infrastructure/types/supabase-cart.types';
import { CartId } from '@/carts/domain/types/cart-id.type';
import { CustomerId } from '@/carts/domain/types/customer-id.type';
import { TenantId } from '@/shared/domain/types/tenant-id.type';
import { CartRepositoryException } from '@/carts/infrastructure/exceptions/cart-repository.exception';

export class SupabaseCartRepository implements CartRepositoryPort {
  constructor(private readonly supabase: SupabaseClient) {}

  async save(cart: Cart): Promise<void> {
    const { cartRow, cartItemsRows } = SupabaseCartMapper.toPersistence(cart);

    const { error } = await this.supabase.rpc('upsert_cart_transactional', {
      cart_data: cartRow,
      items_data: cartItemsRows,
    });

    if (error) {
      if (error.code === 'P0001') {
        throw new CartRepositoryException(
          `Optimistic locking failed: the cart has been updated by another transaction.`,
          error,
        );
      }
      throw new CartRepositoryException(
        `Failed to save cart transactionally: ${error.message}`,
        error,
      );
    }
  }

  async findById(id: CartId, tenantId: TenantId): Promise<Cart | null> {
    const { data, error } = await this.supabase
      .from('carts')
      .select('*, cart_items(*)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      if (error && error.code !== 'PGRST116') {
        // PGRST116 = multiple or no rows returned
        throw new CartRepositoryException(`Database error searching cart: ${error.message}`);
      }
      return null;
    }

    return SupabaseCartMapper.toDomain(data as DbCartRow);
  }

  async findActiveByCustomerId(customerId: CustomerId, tenantId: TenantId): Promise<Cart | null> {
    const { data, error } = await this.supabase
      .from('carts')
      .select('*, cart_items(*)')
      .eq('customer_id', customerId)
      .eq('tenant_id', tenantId)
      .eq('status', 'ACTIVE') // Active cart status
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new CartRepositoryException(`Database error searching active cart: ${error.message}`);
    }

    if (!data) return null;

    return SupabaseCartMapper.toDomain(data as DbCartRow);
  }

  async delete(id: CartId, tenantId: TenantId): Promise<void> {
    // We assume a hard delete is requested ("lo elimina de verdad").
    // First we delete the cart items to avoid FK constraint issues if ON DELETE CASCADE is not set.
    const { error: itemsError } = await this.supabase.from('cart_items').delete().eq('cart_id', id);

    if (itemsError) {
      throw new CartRepositoryException(`Failed to delete cart items: ${itemsError.message}`);
    }

    const { error: cartError } = await this.supabase
      .from('carts')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (cartError) {
      throw new CartRepositoryException(`Failed to delete cart: ${cartError.message}`);
    }
  }
}

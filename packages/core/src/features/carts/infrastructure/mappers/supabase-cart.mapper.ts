import { Cart } from '@/carts/domain/entities/cart.entity';
import { CartItem } from '@/carts/domain/entities/cart-item.entity';
import { DbCartRow, DbCartItemRow } from '@/carts/infrastructure/types/supabase-cart.types';
import { Money } from '@/shared/domain/value-objects/money.vo';
import { parseCartStatus } from '@/carts/domain/enums/cart-status.enum';
import { CartId } from '@/carts/domain/types/cart-id.type';
import { CustomerId } from '@/carts/domain/types/customer-id.type';
import { TenantId } from '@/shared/domain/types/tenant-id.type';
import { CartItemId } from '@/carts/domain/types/cart-item-id.type';
import { ProductId } from '@/carts/domain/types/product-id.type';
import { VariantId } from '@/carts/domain/types/variant-id.type';

export class SupabaseCartMapper {
  static toDomain(row: DbCartRow): Cart {
    const items = (row.cart_items || []).map((itemRow: DbCartItemRow) =>
      CartItem.reconstitute({
        id: itemRow.id as CartItemId,
        productId: itemRow.product_id as ProductId,
        variantId: itemRow.variant_id ? (itemRow.variant_id as VariantId) : null,
        productName: itemRow.product_name,
        sku: itemRow.sku,
        unitPrice: Money.from(itemRow.unit_price_cents, 'USD'),
        quantity: itemRow.quantity,
        subtotal: Money.from(itemRow.subtotal_cents, 'USD'),
      }),
    );

    return Cart.reconstitute({
      id: row.id as CartId,
      tenantId: row.tenant_id as TenantId,
      customerId: row.customer_id ? (row.customer_id as CustomerId) : null,
      items,
      status: parseCartStatus(row.status),
      subtotal: Money.from(row.subtotal_cents, 'USD'),
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      version: row.version ?? 0,
    });
  }

  static toPersistence(cart: Cart): { cartRow: DbCartRow; cartItemsRows: DbCartItemRow[] } {
    const cartRow: DbCartRow = {
      id: cart.getId(),
      tenant_id: cart.getTenantId(),
      customer_id: cart.getCustomerId(),
      status: cart.getStatus(),
      subtotal_cents: cart.getSubtotal().getValue(),
      expires_at: cart.getExpiresAt().toISOString(),
      created_at: cart.getCreatedAt().toISOString(),
      updated_at: cart.getUpdatedAt().toISOString(),
      version: cart.getVersion(),
    };

    const cartItemsRows: DbCartItemRow[] = cart.getItems().map((item: CartItem) => ({
      id: item.getId(),
      cart_id: cart.getId(),
      product_id: item.getProductId(),
      variant_id: item.getVariantId(),
      product_name: item.getProductName(),
      sku: item.getSku(),
      unit_price_cents: item.getUnitPrice().getValue(),
      quantity: item.getQuantity(),
      subtotal_cents: item.getSubtotal().getValue(),
      created_at: cart.getCreatedAt().toISOString(), // Use cart's created_at for simplicity if items don't track individually
      updated_at: cart.getUpdatedAt().toISOString(),
    }));

    return { cartRow, cartItemsRows };
  }
}

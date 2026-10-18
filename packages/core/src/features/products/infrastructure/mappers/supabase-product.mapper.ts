import { Product } from '@/products/domain/entities/product.entity';
import { ProductVariant } from '@/products/domain/entities/product-variant.entity';
import { ProductStatus } from '@/products/domain/enums/product-status.enum';
import { Money } from '@/shared/domain/value-objects/money.vo';
import { ProductName } from '@/products/domain/value-objects/product-name.vo';
import { Sku } from '@/products/domain/value-objects/sku.vo';
import { DbProductRow, DbProductVariantRow } from '../types/supabase-product.types';
import { ProductId, createProductId } from '@/products/domain/types/product-id.type';
import { CategoryId } from '@/products/domain/types/category-id.type';
import { TenantId } from '@/shared/domain/types/tenant-id.type';
import { createVariantId } from '@/products/domain/types/variant-id.type';
import { createSeasonId } from '@/products/domain/types/season-id.type';

export class SupabaseProductMapper {
  public static toDomain(row: DbProductRow): Product {
    // 1. Mapear las variantes primero si vienen en el JOIN
    const variants =
      row.product_variants?.map((v: DbProductVariantRow) =>
        ProductVariant.reconstitute({
          id: createVariantId(v.id),
          productId: createProductId(v.product_id),
          sku: Sku.from(v.sku),
          name: ProductName.from(v.name),
          attributes: v.attributes,
          priceOverride:
            v.price_override_cents !== null ? Money.from(v.price_override_cents) : null,
          stock: v.stock,
          status: v.status as ProductStatus,
        }),
      ) || [];

    return Product.reconstitute({
      id: row.id as ProductId,
      name: ProductName.from(row.name),
      price: Money.from(row.price_cents),
      cost: Money.from(row.cost_cents),
      wholesalePrice: Money.from(row.wholesale_price_cents),
      description: row.description,
      stock: row.stock,
      categoryId: row.category_id as CategoryId,
      expirationDate: row.expiration_date ? new Date(row.expiration_date) : null,
      status: row.status as ProductStatus,
      sku: Sku.from(row.sku),
      tenantId: row.tenant_id as TenantId,
      seasonIds: (row.season_ids || []).map((id: string) => createSeasonId(id)),
      imagePath: row.image_path,
      imageUrl: row.image_url,
      hasVariants: row.has_variants,
      variants: variants,
      isVatExempt: row.is_vat_exempt,
      updatedAt: new Date(row.updated_at),
      version: row.version,
    });
  }

  public static toPersistence(product: Product): Omit<DbProductRow, 'product_variants'> {
    return {
      id: product.getId(),
      name: product.getName(),
      price_cents: product.getPrice().getValue(),
      cost_cents: product.getCost().getValue(),
      wholesale_price_cents: product.getWholesalePrice().getValue(),
      description: product.getDescription(),
      stock: product.getStock(),
      category_id: product.getCategory(),
      expiration_date: product.getExpirationDate()?.toISOString() || null,
      status: product.getStatus(),
      sku: product.getSku(),
      tenant_id: product.getTenantId(),
      season_ids: product.getSeasonIds(),
      image_path: product.getImagePath(),
      image_url: product.getImageUrl(),
      has_variants: product.getHasVariants(),
      is_vat_exempt: product.getIsVatExempt(),
      version: product.getVersion(),
      updated_at: product.getUpdatedAt().toISOString(),
    };
  }
}

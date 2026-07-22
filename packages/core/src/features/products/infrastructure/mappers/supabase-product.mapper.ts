import { Product } from '@/products/domain/entities/product.entity';
import { ProductVariant } from '@/products/domain/entities/product-variant.entity';
import { ProductStatus } from '@/products/domain/enums/product-status.enum';
import { Money } from '@/shared/domain/value-objects/money.vo';
import { ProductName } from '@/products/domain/value-objects/product-name.vo';
import { Sku } from '@/products/domain/value-objects/sku.vo';
import { DbProductRow, DbProductVariantRow } from '../types/supabase-product.types';

export class SupabaseProductMapper {
    public static toDomain(row: DbProductRow): Product {
        // 1. Mapear las variantes primero si vienen en el JOIN
        const variants = row.product_variants?.map((v: DbProductVariantRow) =>
            ProductVariant.reconstitute({
                id: v.id,
                productId: v.product_id,
                sku: Sku.from(v.sku),
                name: ProductName.from(v.name),
                attributes: v.attributes,
                priceOverride: v.price_override_cents !== null
                    ? Money.from(v.price_override_cents / 100)
                    : null,
                stock: v.stock,
                status: v.status as ProductStatus
            })
        ) || [];

        return Product.reconstitute({
            id: row.id,
            name: ProductName.from(row.name),
            price: Money.from(row.price_cents / 100),
            cost: Money.from(row.cost_cents / 100),
            wholesalePrice: Money.from(row.wholesale_price_cents / 100),
            description: row.description,
            stock: row.stock,
            categoryId: row.category_id,
            expirationDate: row.expiration_date ? new Date(row.expiration_date) : null,
            status: row.status as ProductStatus,
            sku: Sku.from(row.sku),
            tenantId: row.tenant_id,
            seasonIds: row.season_ids || [],
            imagePath: row.image_path,
            imageUrl: row.image_url,
            hasVariants: row.has_variants,
            variants: variants,
            isVatExempt: row.is_vat_exempt
        });
    }

    public static toPersistence(product: Product): Omit<DbProductRow, 'product_variants'> {
        return {
            id: product.getId(),
            name: product.getName(),
            price_cents: Math.round(product.getPrice().getValue() * 100),
            cost_cents: Math.round(product.getCost().getValue() * 100),
            wholesale_price_cents: Math.round(product.getWholesalePrice().getValue() * 100),
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
            is_vat_exempt: product.getIsVatExempt()
        };
    }
}
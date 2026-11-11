import type { DomainEventEnvelope } from '@/shared/application/ports/out/event-bus.port';
import { PRODUCT_AGGREGATE_TYPE } from '@/products/application/outbox/product-aggregate.constants';
import { ProductStockAdjustedEvent } from '@/products/domain/events/product-stock-adjusted.event';
import type { ProductId } from '@/products/domain/types/product-id.type';
import type { TenantId } from '@/shared/domain/types/tenant-id.type';

/** Outbox envelope for a stock movement made by an order, so Kivi syncs the new stock. */
export function productStockAdjustedEnvelope(
  tenantId: TenantId,
  productId: ProductId,
  stock: number,
): DomainEventEnvelope {
  return {
    context: { tenantId, aggregateType: PRODUCT_AGGREGATE_TYPE, aggregateId: productId },
    event: new ProductStockAdjustedEvent(productId, stock),
  };
}

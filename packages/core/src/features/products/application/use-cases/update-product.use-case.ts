import { PRODUCT_AGGREGATE_TYPE } from '@/products/application/outbox/product-aggregate.constants';
import { ProductRepositoryPort } from '@/products/application/ports/out/product-repository.port';
import { ProductNotFoundException } from '@/products/application/exceptions/product-not-found.exception';
import { UpdateProductDto } from '@/products/application/dtos/update-product.dto';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { ProductName } from '@/products/domain/value-objects/product-name.vo';
import { Sku } from '@/products/domain/value-objects/sku.vo';
import { Money } from '@/shared/domain/value-objects/money.vo';
import { createProductId } from '@/products/domain/types/product-id.type';
import { createCategoryId } from '@/products/domain/types/category-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { createSeasonId } from '@/products/domain/types/season-id.type';
import { TransactionManagerPort } from '@/shared/application/ports/out/transaction-manager.port';
import { OptimisticConcurrencyException } from '@/shared/application/exceptions/optimistic-concurrency.exception';

export class UpdateProductUseCase {
  constructor(
    private readonly productRepository: ProductRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly transactionManager: TransactionManagerPort,
  ) {}

  async execute(dto: UpdateProductDto): Promise<void> {
    await this.transactionManager.runInTransaction(
      async (tx) => {
        const productId = createProductId(dto.productId);
        const tenantId = createTenantId(dto.tenantId);

        const product = await this.productRepository.findById(productId, tenantId, tx);

        if (!product) {
          throw new ProductNotFoundException(dto.productId);
        }

        if (product.getVersion() !== dto.expectedVersion) {
          throw new OptimisticConcurrencyException('Product', dto.productId);
        }

        const name = ProductName.from(dto.name);
        const sku = Sku.from(dto.sku);
        const price = Money.from(dto.price);
        const cost = Money.from(dto.cost);
        const wholesalePrice = dto.wholesalePrice ? Money.from(dto.wholesalePrice) : Money.from(0);
        const categoryId = createCategoryId(dto.categoryId);
        const seasonIds = dto.seasonIds.map((id) => createSeasonId(id));

        product.changeDetails(
          name,
          dto.description || '',
          categoryId,
          sku,
          seasonIds,
          dto.isVatExempt,
        );
        product.changePricing(price, cost, wholesalePrice);

        if (dto.stock !== undefined) {
          product.adjustStock(dto.stock);
        }

        await this.productRepository.save(product, tx);

        if (product.domainEvents.length > 0) {
          const envelopes = product.domainEvents.map((event) => ({
            event,
            context: {
              tenantId: dto.tenantId,
              aggregateType: PRODUCT_AGGREGATE_TYPE,
              aggregateId: product.getId(),
            },
          }));
          await this.eventBus.publish(envelopes, tx);
          product.clearDomainEvents();
        }
      },
      { userId: dto.tenantId },
    );
  }
}

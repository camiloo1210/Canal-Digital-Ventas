import { PRODUCT_AGGREGATE_TYPE } from '@/products/application/outbox/product-aggregate.constants';
import { ProductRepositoryPort } from '@/products/application/ports/out/product-repository.port';
import { UnarchiveProductDto } from '@/products/application/dtos/unarchive-product.dto';
import { ProductNotFoundException } from '@/products/application/exceptions/product-not-found.exception';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { createProductId } from '@/products/domain/types/product-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { TransactionManagerPort } from '@/shared/application/ports/out/transaction-manager.port';
import { OptimisticConcurrencyException } from '@/shared/application/exceptions/optimistic-concurrency.exception';

export class UnarchiveProductUseCase {
  constructor(
    private readonly productRepository: ProductRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly transactionManager: TransactionManagerPort,
  ) {}

  async execute(dto: UnarchiveProductDto & { expectedVersion?: number }): Promise<string> {
    return this.transactionManager.runInTransaction(
      async (tx) => {
        const productId = createProductId(dto.id);
        const tenantId = createTenantId(dto.tenantId);

        const product = await this.productRepository.findById(productId, tenantId, tx);

        if (!product) {
          throw new ProductNotFoundException(dto.id);
        }

        if (dto.expectedVersion !== undefined && product.getVersion() !== dto.expectedVersion) {
          throw new OptimisticConcurrencyException('Product', dto.id);
        }

        product.unarchive();
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

        return product.getId();
      },
      { userId: dto.tenantId },
    );
  }
}

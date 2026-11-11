import { PRODUCT_AGGREGATE_TYPE } from '@/products/application/outbox/product-aggregate.constants';
import { ProductRepositoryPort } from '@/products/application/ports/out/product-repository.port';
import { ProductNotFoundException } from '@/products/application/exceptions/product-not-found.exception';
import { ChangeProductStatusDto } from '@/products/application/dtos/change-product-status.dto';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { TransactionManagerPort } from '@/shared/application/ports/out/transaction-manager.port';
import { parseProductStatus } from '@/products/domain/enums/product-status.enum';
import { createProductId } from '@/products/domain/types/product-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';

export class ChangeProductStatusUseCase {
  constructor(
    private readonly productRepository: ProductRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly transactionManager: TransactionManagerPort,
  ) {}

  async execute(dto: ChangeProductStatusDto): Promise<void> {
    const productId = createProductId(dto.productId);
    const tenantId = createTenantId(dto.tenantId);

    await this.transactionManager.runInTransaction(
      async (tx): Promise<void> => {
        const product = await this.productRepository.findById(productId, tenantId, tx);

        if (!product) {
          throw new ProductNotFoundException(dto.productId);
        }

        product.changeStatus(parseProductStatus(dto.status));

        await this.productRepository.save(product, tx);

        if (product.domainEvents.length > 0) {
          await this.eventBus.publish(
            product.domainEvents.map((event) => ({
              event,
              context: {
                tenantId: dto.tenantId,
                aggregateType: PRODUCT_AGGREGATE_TYPE,
                aggregateId: product.getId(),
              },
            })),
            tx,
          );
        }
        product.clearDomainEvents();
      },
      { userId: dto.tenantId },
    );
  }
}

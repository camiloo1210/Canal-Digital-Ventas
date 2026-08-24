import { ProductRepositoryPort } from '@/products/application/ports/out/product-repository.port';
import { ArchiveProductDto } from '@/products/application/dtos/archive-product.dto';
import { ProductNotFoundException } from '@/products/application/exceptions/product-not-found.exception';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';

export class ArchiveProductUseCase {
  constructor(
    private readonly productRepository: ProductRepositoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(dto: ArchiveProductDto): Promise<string> {
    const product = await this.productRepository.findById(dto.id, dto.tenantId);

    if (!product) {
      throw new ProductNotFoundException(dto.id);
    }

    product.archive();
    await this.productRepository.save(product);

    if (product.domainEvents.length > 0) {
      await this.eventBus.publish(product.domainEvents);
    }
    product.clearDomainEvents();

    return product.getId();
  }
}

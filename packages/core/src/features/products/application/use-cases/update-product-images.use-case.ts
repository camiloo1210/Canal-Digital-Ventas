import { ProductRepositoryPort } from '@/products/application/ports/out/product-repository.port';
import { ProductNotFoundException } from '@/products/application/exceptions/product-not-found.exception';
import { UpdateProductImagesDto } from '@/products/application/dtos/update-product-images.dto';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { createProductId } from '@/products/domain/types/product-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';

export class UpdateProductImagesUseCase {
  constructor(
    private readonly productRepository: ProductRepositoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(dto: UpdateProductImagesDto): Promise<void> {
    const productId = createProductId(dto.productId);
    const tenantId = createTenantId(dto.tenantId);

    const product = await this.productRepository.findById(productId, tenantId);

    if (!product) {
      throw new ProductNotFoundException(dto.productId);
    }

    product.updateImages(dto.imagePath, dto.imageUrl);

    await this.productRepository.save(product);

    if (product.domainEvents.length > 0) {
      await this.eventBus.publish(product.domainEvents);
    }
    product.clearDomainEvents();
  }
}

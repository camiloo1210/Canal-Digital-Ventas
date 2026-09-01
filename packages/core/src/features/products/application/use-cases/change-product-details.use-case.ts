import { ProductRepositoryPort } from '@/products/application/ports/out/product-repository.port';
import { ProductNotFoundException } from '@/products/application/exceptions/product-not-found.exception';
import { ChangeProductDetailsDto } from '@/products/application/dtos/change-product-details.dto';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { ProductName } from '@/products/domain/value-objects/product-name.vo';
import { Sku } from '@/products/domain/value-objects/sku.vo';
import { createProductId } from '@/products/domain/types/product-id.type';
import { createCategoryId } from '@/products/domain/types/category-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { createSeasonId } from '@/products/domain/types/season-id.type';

export class ChangeProductDetailsUseCase {
  constructor(
    private readonly productRepository: ProductRepositoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(dto: ChangeProductDetailsDto): Promise<void> {
    const productId = createProductId(dto.productId);
    const tenantId = createTenantId(dto.tenantId);

    const product = await this.productRepository.findById(productId, tenantId);

    if (!product) {
      throw new ProductNotFoundException(dto.productId);
    }

    product.changeDetails(
      ProductName.from(dto.name),
      dto.description,
      createCategoryId(dto.categoryId),
      Sku.from(dto.sku),
      dto.seasonIds.map((id) => createSeasonId(id)),
      dto.isVatExempt,
    );

    await this.productRepository.save(product);

    if (product.domainEvents.length > 0) {
      await this.eventBus.publish(product.domainEvents);
    }
    product.clearDomainEvents();
  }
}

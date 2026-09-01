import { ProductRepositoryPort } from '@/products/application/ports/out/product-repository.port';
import { ProductNotFoundException } from '@/products/application/exceptions/product-not-found.exception';
import { SetProductVariantsDto } from '@/products/application/dtos/set-product-variants.dto';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { createProductId } from '@/products/domain/types/product-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { createVariantId } from '@/products/domain/types/variant-id.type';
import { ProductVariant } from '@/products/domain/entities/product-variant.entity';
import { Sku } from '@/products/domain/value-objects/sku.vo';
import { ProductName } from '@/products/domain/value-objects/product-name.vo';
import { Money } from '@/shared/domain/value-objects/money.vo';
import { parseProductStatus } from '@/products/domain/enums/product-status.enum';

export class SetProductVariantsUseCase {
  constructor(
    private readonly productRepository: ProductRepositoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(dto: SetProductVariantsDto): Promise<void> {
    const productId = createProductId(dto.productId);
    const tenantId = createTenantId(dto.tenantId);

    const product = await this.productRepository.findById(productId, tenantId);

    if (!product) {
      throw new ProductNotFoundException(dto.productId);
    }

    const domainVariants = dto.variants.map((v) =>
      ProductVariant.create(
        createVariantId(v.id),
        productId,
        Sku.from(v.sku),
        ProductName.from(v.name),
        v.attributes,
        v.stock,
        v.priceOverride ? Money.from(v.priceOverride) : undefined,
        v.status ? parseProductStatus(v.status) : undefined,
      ),
    );

    product.setVariants(domainVariants);

    await this.productRepository.save(product);

    if (product.domainEvents.length > 0) {
      await this.eventBus.publish(product.domainEvents);
    }
    product.clearDomainEvents();
  }
}

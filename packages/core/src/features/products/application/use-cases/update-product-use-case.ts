import { ProductRepositoryPort } from '@/products/application/ports/out/product-repository.port';
import { ProductNotFoundException } from '@/products/application/exceptions/product-not-found.exception';
import { UpdateProductDto } from '@/products/application/dtos/update-product.dto';
import { Money } from '@/shared/domain/value-objects/money.vo';
import { parseProductStatus } from '@/products/domain/enums/product-status.enum';
import { FileStoragePort } from '@/products/application/ports/out/file-storage.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { ProductName } from '@/products/domain/value-objects/product-name.vo';
import { Sku } from '@/products/domain/value-objects/sku.vo';

export class UpdateProductUseCase {
  constructor(
    private readonly productRepository: ProductRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly fileStorage?: FileStoragePort,
  ) {}

  async execute(dto: UpdateProductDto): Promise<void> {
    const product = await this.productRepository.findById(dto.id, dto.tenantId);

    if (!product) {
      throw new ProductNotFoundException(dto.id);
    }

    // In a real DDD application, "UpdateProductUseCase" should ideally be broken down into
    // specific commands like "ChangeProductPricingUseCase" or "UpdateProductDetailsUseCase".
    // For a generic update, we map the DTO to the business actions exposed by the aggregate.

    if (
      dto.name !== undefined ||
      dto.description !== undefined ||
      dto.categoryId !== undefined ||
      dto.sku !== undefined ||
      dto.seasonIds !== undefined ||
      dto.isVatExempt !== undefined
    ) {
      product.changeDetails(
        dto.name !== undefined ? ProductName.from(dto.name) : ProductName.from(product.getName()),
        dto.description !== undefined ? dto.description : product.getDescription(),
        dto.categoryId !== undefined ? dto.categoryId : product.getCategory(),
        dto.sku !== undefined ? Sku.from(dto.sku) : Sku.from(product.getSku()),
        dto.seasonIds !== undefined ? dto.seasonIds : product.getSeasonIds(),
        dto.isVatExempt !== undefined ? dto.isVatExempt : product.getIsVatExempt(),
      );
    }

    if (dto.price !== undefined || dto.cost !== undefined || dto.wholesalePrice !== undefined) {
      product.changePricing(
        dto.price !== undefined ? Money.from(dto.price) : product.getPrice(),
        dto.cost !== undefined ? Money.from(dto.cost) : product.getCost(),
        dto.wholesalePrice !== undefined
          ? Money.from(dto.wholesalePrice)
          : product.getWholesalePrice(),
      );
    }

    if (dto.stock !== undefined) {
      product.adjustStock(dto.stock);
    }

    if (dto.expirationDate !== undefined) {
      product.changeExpirationDate(dto.expirationDate ? new Date(dto.expirationDate) : null);
    }

    if (dto.status !== undefined) {
      product.changeStatus(parseProductStatus(dto.status));
    }

    let imagePath = dto.imagePath !== undefined ? dto.imagePath : product.getImagePath();
    let imageUrl = dto.imageUrl !== undefined ? dto.imageUrl : product.getImageUrl();

    if (dto.image && this.fileStorage) {
      const imageFile = dto.image as { name?: string };
      const ext = imageFile.name?.split('.').pop() || 'jpg';
      const timestamp = Date.now();
      const destinationPath = `products/${product.getId()}_${timestamp}.${ext}`;
      const uploadResult = await this.fileStorage.upload(dto.image, destinationPath);
      imagePath = uploadResult.path;
      imageUrl = uploadResult.url;
    }

    if (imagePath !== product.getImagePath() || imageUrl !== product.getImageUrl()) {
      product.updateImages(imagePath || null, imageUrl || null);
    }

    if (dto.hasVariants !== undefined) {
      // Assuming variants updates might be handled separately or here depending on logic
      // In this refactoring, we'll keep the basic setter for now as it needs a specific VO or Entity rule
    }

    await this.productRepository.save(product);

    if (product.domainEvents.length > 0) {
      await this.eventBus.publish(product.domainEvents);
    }
    product.clearDomainEvents();
  }
}

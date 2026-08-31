import { CreateProductDto } from '@/products/application/dtos/create-product.dto';
import { Product } from '@/products/domain/entities/product.entity';
import { ProductName } from '@/products/domain/value-objects/product-name.vo';
import { Sku } from '@/products/domain/value-objects/sku.vo';
import { Money } from '@/shared/domain/value-objects/money.vo';
import { ProductRepositoryPort } from '@/products/application/ports/out/product-repository.port';
import { FileStoragePort } from '@/products/application/ports/out/file-storage.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { createProductId } from '@/products/domain/types/product-id.type';
import { createCategoryId } from '@/products/domain/types/category-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';

export class CreateProductUseCase {
  constructor(
    private readonly productRepository: ProductRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly fileStorage?: FileStoragePort,
  ) {}

  async execute(dto: CreateProductDto): Promise<string> {
    const name = ProductName.from(dto.name);
    const sku = Sku.from(dto.sku);
    const price = Money.from(dto.price);
    const cost = Money.from(dto.cost);
    const wholesalePrice = dto.wholesalePrice ? Money.from(dto.wholesalePrice) : null;

    let imagePath: string | null = null;
    let imageUrl: string | null = null;

    if (dto.image && this.fileStorage) {
      const imageFile = dto.image as { name?: string };
      const ext = imageFile.name?.split('.').pop() || 'jpg';
      const destinationPath = `products/${dto.id}.${ext}`;
      const uploadResult = await this.fileStorage.upload(dto.image, destinationPath);
      imagePath = uploadResult.path;
      imageUrl = uploadResult.url;
    }

    const productId = createProductId(dto.id);
    const categoryId = createCategoryId(dto.categoryId);
    const tenantId = createTenantId(dto.tenantId);

    const newProduct = Product.create(
      productId,
      name,
      price,
      cost,
      dto.description,
      dto.stock,
      categoryId,
      sku,
      tenantId,
      null, // expirationDate
      null, // status
      dto.seasonIds,
      imagePath,
      [], // variants
      dto.isVatExempt,
      wholesalePrice,
    );

    if (imageUrl) {
      newProduct.updateImages(imagePath, imageUrl);
    }

    await this.productRepository.save(newProduct);

    if (newProduct.domainEvents.length > 0) {
      await this.eventBus.publish(newProduct.domainEvents);
    }
    newProduct.clearDomainEvents();

    return newProduct.getId();
  }
}

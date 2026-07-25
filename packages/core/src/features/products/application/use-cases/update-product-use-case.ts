import { ProductRepositoryPort } from '@/products/application/ports/out/product-repository.port';
import { ProductNotFoundException } from '@/products/application/exceptions/product-not-found.exception';
import { UpdateProductDto } from '@/products/application/dtos/update-product.dto';
import { Money } from '@/shared/domain/value-objects/money.vo';
import { parseProductStatus, ProductStatus } from '@/products/domain/enums/product-status.enum';
import { FileStoragePort } from '@/products/application/ports/out/file-storage.port';

export class UpdateProductUseCase {


    constructor(
        private readonly productRepository: ProductRepositoryPort,
        private readonly fileStorage?: FileStoragePort
    ) { }


    async execute(dto: UpdateProductDto): Promise<void> {

        const product = await this.productRepository.findById(dto.id);

        if (!product || product.getTenantId() !== dto.tenantId) {
            throw new ProductNotFoundException(dto.id);
        }
        if (dto.name !== undefined) {
            product.updateName(dto.name);
        }
        if (dto.price !== undefined) {
            product.updatePrice(Money.from(dto.price));
        }
        if (dto.stock !== undefined) {
            product.updateStock(dto.stock);
        }
        if (dto.cost !== undefined) {
            product.updateCost(Money.from(dto.cost));
        }
        if (dto.wholesalePrice !== undefined) {
            product.updateWholesalePrice(Money.from(dto.wholesalePrice));
        }
        if (dto.description !== undefined) {
            product.updateDescription(dto.description);
        }
        if (dto.categoryId !== undefined) {
            product.updateCategory(dto.categoryId);
        }
        if (dto.expirationDate !== undefined) {
            product.updateExpirationDate(new Date(dto.expirationDate));
        }
        if (dto.status !== undefined) {
            product.updateStatus(parseProductStatus(dto.status));
        }
        if (dto.sku !== undefined) {
            product.updateSku(dto.sku);
        }
        if (dto.seasonIds !== undefined) {
            product.updateSeasonIds(dto.seasonIds);
        }
        if (dto.imagePath !== undefined) {
            product.updateImagePath(dto.imagePath);
        }
        if (dto.imageUrl !== undefined) {
            product.updateImageUrl(dto.imageUrl);
        }
        if (dto.hasVariants !== undefined) {
            product.updateHasVariants(dto.hasVariants);
        }
        if (dto.isVatExempt !== undefined) {
            product.updateIsVatExempt(dto.isVatExempt);
        }

        if (dto.image && this.fileStorage) {
            const ext = dto.image.name?.split('.').pop() || 'jpg';
            const timestamp = Date.now();
            const destinationPath = `products/${product.getId()}_${timestamp}.${ext}`;
            const uploadResult = await this.fileStorage.upload(dto.image, destinationPath);
            product.updateImagePath(uploadResult.path);
            product.updateImageUrl(uploadResult.url);
        }

        await this.productRepository.save(product);
    }
}
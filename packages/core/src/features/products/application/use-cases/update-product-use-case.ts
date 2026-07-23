import { ProductRepositoryPort } from '@/products/application/ports/out/product-repository.port';
import { ProductNotFoundException } from '@/products/application/exceptions/product-not-found.exception';
import { UpdateProductDto } from '@/products/application/dtos/update-product.dto';
import { Money } from '@/shared/domain/value-objects/money.vo';
import { parseProductStatus, ProductStatus } from '@/products/domain/enums/product-status.enum';

export class UpdateProductUseCase {


    constructor(private readonly productRepository: ProductRepositoryPort) { }


    async execute(dto: UpdateProductDto): Promise<void> {

        const product = await this.productRepository.findById(dto.id);

        if (!product) {
            throw new ProductNotFoundException(dto.id);
        }
        product.updateStock(dto.stock);
        product.updatePrice(Money.from(dto.price));
        product.updateCost(Money.from(dto.cost));
        product.updateWholesalePrice(Money.from(dto.wholesalePrice));
        product.updateDescription(dto.description);
        product.updateCategory(dto.categoryId);
        product.updateExpirationDate(new Date(dto.expirationDate));
        product.updateStatus(parseProductStatus(dto.status));
        product.updateSku(dto.sku);
        product.updateSeasonIds(dto.seasonIds);
        product.updateImagePath(dto.imagePath);
        product.updateImageUrl(dto.imageUrl);
        product.updateHasVariants(dto.hasVariants);
        product.updateIsVatExempt(dto.isVatExempt);
        await this.productRepository.save(product);
    }
}
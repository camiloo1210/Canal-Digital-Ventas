import { CreateProductDto } from '@/products/application/dtos/create-product.dto';
import { Product } from '@/products/domain/entities/product.entity';
import { ProductName } from '@/products/domain/value-objects/product-name.vo';
import { Sku } from '@/products/domain/value-objects/sku.vo';
import { Money } from '@/shared/domain/value-objects/money.vo';
import { ProductRepositoryPort } from '@/products/application/ports/out/product-repository.port';

export class CreateProductUseCase {


    constructor(private readonly productRepository: ProductRepositoryPort) { }

    async execute(dto: CreateProductDto): Promise<string> {


        const name = ProductName.from(dto.name);
        const sku = Sku.from(dto.sku);
        const price = Money.from(dto.price);
        const cost = Money.from(dto.cost);
        const wholesalePrice = dto.wholesalePrice ? Money.from(dto.wholesalePrice) : undefined;

        const newProduct = Product.create(
            dto.id,
            name,
            price,
            cost,
            dto.description,
            dto.stock,
            dto.categoryId,
            sku,
            dto.tenantId,
            undefined,
            undefined,
            dto.seasonIds,
            undefined,
            [],
            dto.isVatExempt,
            wholesalePrice
        );

        await this.productRepository.save(newProduct);


        return newProduct.getId();
    }
}
import { ProductRepositoryPort } from '@/products/application/ports/out/product-repository.port';
import { ArchiveProductDto } from '@/products/application/dtos/archive-product.dto';

export class ArchiveProductUseCase {


    constructor(private readonly productRepository: ProductRepositoryPort) { }

    async execute(dto: ArchiveProductDto): Promise<string> {
        const productId = dto.id

        await this.productRepository.archive(productId);

        return productId;
    }
}
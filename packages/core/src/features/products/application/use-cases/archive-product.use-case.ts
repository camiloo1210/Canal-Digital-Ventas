import { ProductRepositoryPort } from '@/products/application/ports/out/product-repository.port';
import { ArchiveProductDto } from '@/products/application/dtos/archive-product.dto';
import { ProductNotFoundException } from '@/products/application/exceptions/product-not-found.exception';

export class ArchiveProductUseCase {


    constructor(private readonly productRepository: ProductRepositoryPort) { }

    async execute(dto: ArchiveProductDto): Promise<string> {
        const product = await this.productRepository.findById(dto.id);

        if (!product || product.getTenantId() !== dto.tenantId) {
            throw new ProductNotFoundException(dto.id);
        }

        product.archive();
        await this.productRepository.save(product);

        return product.getId();
    }
}
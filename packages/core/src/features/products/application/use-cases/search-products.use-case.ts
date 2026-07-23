import { ProductRepositoryPort, ProductFilters } from '@/products/application/ports/out/product-repository.port';
import { SearchProductsDto } from '@/products/application/dtos/search-products.dto';
import { Product } from '@/products/domain/entities/product.entity';
import { parseProductStatus } from '@/products/domain/enums/product-status.enum';

export class SearchProductsUseCase {

    constructor(private readonly productRepository: ProductRepositoryPort) { }

    async execute(dto: SearchProductsDto): Promise<Product[]> {

        const filters: ProductFilters = {
            id: dto.id,
            name: dto.name,
            categoryId: dto.categoryId,
            sku: dto.sku,
            tenantId: dto.tenantId,
            status: dto.status ? parseProductStatus(dto.status) : undefined,
        };
        return await this.productRepository.searchByFilters(filters);
    }
}
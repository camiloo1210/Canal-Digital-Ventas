import { ProductRepositoryPort } from '@/products/application/ports/out/product-repository.port';
import { SearchProductsDto } from '@/products/application/dtos/search-products.dto';
import { PaginatedResult } from '@/shared/domain/pagination/pagination';
import { Product } from '@/products/domain/entities/product.entity';
import { parseProductStatus } from '@/products/domain/enums/product-status.enum';
import { createProductId } from '@/products/domain/types/product-id.type';
import { createCategoryId } from '@/products/domain/types/category-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';

export class SearchProductsUseCase {
  constructor(private readonly productRepository: ProductRepositoryPort) {}

  async execute(dto: SearchProductsDto): Promise<PaginatedResult<Product>> {
    const filters = {
      id: dto.id ? createProductId(dto.id) : undefined,
      name: dto.name,
      categoryId: dto.categoryId ? createCategoryId(dto.categoryId) : undefined,
      sku: dto.sku,
      tenantId: createTenantId(dto.tenantId),
      status: dto.status ? parseProductStatus(dto.status) : undefined,
    };

    return this.productRepository.searchByFilters(filters, dto.pagination);
  }
}

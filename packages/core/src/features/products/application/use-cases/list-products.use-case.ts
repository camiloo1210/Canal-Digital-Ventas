import { ProductRepositoryPort } from '@/products/application/ports/out/product-repository.port';
import { ListProductsDto } from '@/products/application/dtos/list-products.dto';
import { PaginatedResult } from '@/shared/domain/pagination/pagination';
import { Product } from '@/products/domain/entities/product.entity';

export class ListProductsUseCase {
  constructor(private readonly productRepository: ProductRepositoryPort) {}

  async execute(dto: ListProductsDto): Promise<PaginatedResult<Product>> {
    return await this.productRepository.findAll(dto.tenantId, dto.pagination);
  }
}

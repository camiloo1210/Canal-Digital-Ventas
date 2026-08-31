import { ProductRepositoryPort } from '@/products/application/ports/out/product-repository.port';
import { DeleteProductDto } from '@/products/application/dtos/delete-product.dto';
import { ProductNotFoundException } from '@/products/application/exceptions/product-not-found.exception';
import { createProductId } from '@/products/domain/types/product-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';

export class DeleteProductUseCase {
  constructor(private readonly productRepository: ProductRepositoryPort) {}

  async execute(dto: DeleteProductDto): Promise<string> {
    const productId = createProductId(dto.id);
    const tenantId = createTenantId(dto.tenantId);

    const product = await this.productRepository.findById(productId, tenantId);

    if (!product) {
      throw new ProductNotFoundException(dto.id);
    }

    await this.productRepository.delete(productId, tenantId);

    return dto.id;
  }
}

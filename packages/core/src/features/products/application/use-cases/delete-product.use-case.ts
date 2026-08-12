import { ProductRepositoryPort } from '@/products/application/ports/out/product-repository.port';
import { DeleteProductDto } from '@/products/application/dtos/delete-product.dto';
import { ProductNotFoundException } from '@/products/application/exceptions/product-not-found.exception';

export class DeleteProductUseCase {
  constructor(private readonly productRepository: ProductRepositoryPort) {}

  async execute(dto: DeleteProductDto): Promise<string> {
    const product = await this.productRepository.findById(dto.id);

    if (!product || product.getTenantId() !== dto.tenantId) {
      throw new ProductNotFoundException(dto.id);
    }

    await this.productRepository.deleteById(dto.id);

    return dto.id;
  }
}

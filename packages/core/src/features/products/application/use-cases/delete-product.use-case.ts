import { ProductRepositoryPort } from '@/products/application/ports/out/product-repository.port';
import { DeleteProductDto } from '@/products/application/dtos/delete-product.dto';

export class DeleteProductUseCase {


    constructor(private readonly productRepository: ProductRepositoryPort) { }

    async execute(dto: DeleteProductDto): Promise<string> {
        const productId = dto.id

        await this.productRepository.deleteById(productId);

        return productId;
    }
}
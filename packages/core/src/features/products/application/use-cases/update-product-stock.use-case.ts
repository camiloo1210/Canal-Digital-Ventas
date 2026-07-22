import { ProductRepositoryPort } from '@/products/application/ports/out/product-repository.port';
import { ProductNotFoundException } from '@/products/application/exceptions/product-not-found.exception';

export class UpdateProductStockUseCase {

    //TODO: Implement Update DTO 
    constructor(private readonly productRepository: ProductRepositoryPort) { }


    async execute(productId: string, newStock: number): Promise<void> {


        const product = await this.productRepository.findById(productId);

        if (!product) {
            throw new ProductNotFoundException(productId);
        }


        product.updateStock(newStock);


        await this.productRepository.save(product);
    }
}
import { OrderRepositoryPort } from '@/orders/application/ports/out/order-repository.port';
import { ProductRepositoryPort } from '@/products/application/ports/out/product-repository.port';
import {
  TransactionManagerPort,
  TransactionContext,
} from '@/shared/application/ports/out/transaction-manager.port';
import { GenerateCommercialOrderDto } from '@/orders/application/dtos/generate-commercial-order.dto';
import { OrderItem } from '@/orders/domain/entities/order-item.entity';
import { Order } from '@/orders/domain/entities/order.entity';
import { Address } from '@/shared/domain/value-objects/adress.vo';
import { Money } from '@/shared/domain/value-objects/money.vo';
import { Currency } from '@/shared/domain/enums/currency.enum';
import { createOrderId } from '@/orders/domain/types/order-id.type';
import { createOrderItemId } from '@/orders/domain/types/order-item-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { createCustomerId } from '@/orders/domain/types/customer-id.type';
import { createProductId } from '@/products/domain/types/product-id.type';
import { ProductStatus } from '@/products/domain/enums/product-status.enum';

export class ProductOutOfStockException extends Error {
  constructor() {
    super('Product is out of stock.');
    this.name = 'ProductOutOfStockException';
  }
}

export class ProductUnavailableException extends Error {
  constructor() {
    super('Product is unavailable.');
    this.name = 'ProductUnavailableException';
  }
}

export class GenerateCommercialOrderUseCase {
  constructor(
    private readonly orderRepository: OrderRepositoryPort,
    private readonly productRepository: ProductRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
  ) {}

  async execute(dto: GenerateCommercialOrderDto): Promise<void> {
    await this.transactionManager.runInTransaction(
      async (tx: TransactionContext) => {
        const tenantId = createTenantId(dto.tenantId);
        const customerId = createCustomerId(dto.buyerId);

        const orderItems: OrderItem[] = [];
        let subtotalAmount = 0;
        let currency = Currency.USD; // Arbitrary default, should come from product

        for (const itemDto of dto.items) {
          const productId = createProductId(itemDto.productId);

          // 1. Authoritative lookup & ownership validation (findById checks tenantId)
          const product = await this.productRepository.findById(productId, tenantId, tx);

          if (!product) {
            throw new ProductUnavailableException();
          }

          // 2. Availability validation
          if (product.getStatus() !== ProductStatus.ACTIVE) {
            throw new ProductUnavailableException();
          }

          // 3. Stock validation
          if (product.getStock() < itemDto.quantity) {
            throw new ProductOutOfStockException();
          }

          // 4. Pricing (Business Rules)
          let authoritativePrice = product.getPrice().getValue();
          currency = product.getPrice().getCurrency();

          const wholesaleMin = product.getWholesaleMinQuantity();
          const wholesalePrice = product.getWholesalePrice();
          if (
            wholesaleMin !== null &&
            itemDto.quantity >= wholesaleMin &&
            wholesalePrice !== null &&
            wholesalePrice.getValue() > 0
          ) {
            authoritativePrice = wholesalePrice.getValue();
          }

          const unitPriceMoney = Money.from(authoritativePrice, currency);

          const orderItem = OrderItem.create(
            createOrderItemId(crypto.randomUUID()),
            productId,
            product.getName(),
            itemDto.quantity,
            unitPriceMoney,
            product.getSku(),
          );

          orderItems.push(orderItem);
          subtotalAmount += authoritativePrice * itemDto.quantity;
        }

        // Totals
        const subtotal = Money.from(subtotalAmount, currency);
        const taxAmount = Money.from(0, currency);
        const discountAmount = Money.from(0, currency);
        const shippingCost = Money.from(0, currency);

        // Fake address for now since we just create a DRAFT/PENDING order
        const shippingAddress = Address.create('Pending', 'Pending', 'Pending', '00000', 'Pending');

        const orderId = createOrderId(crypto.randomUUID());
        const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;

        // 5. Create CommercialOrder
        const order = Order.create(
          orderId,
          orderNumber,
          customerId,
          tenantId,
          orderItems,
          subtotal,
          taxAmount,
          discountAmount,
          shippingCost,
          shippingAddress,
        );

        // Convert DRAFT to PENDING_PAYMENT
        order.confirm();

        // 6. Commit
        await this.orderRepository.save(order, tx);
      },
      { userId: dto.buyerId },
    );
  }
}

import { OrderRepositoryPort } from '@/orders/application/ports/out/order-repository.port';
import { StoreCustomerRepositoryPort } from '@/sales/application/ports/out/store-customer-repository.port';
import { OrderTenantRepositoryPort } from '@/orders/application/ports/out/order-tenant-repository.port';
import { TenantNotAvailableException } from '@/orders/application/exceptions/tenant-not-available.exception';
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
import { createCustomerId } from '@/orders/domain/types/customer-id.type';
import { createGlobalAuthId } from '@/sales/domain/types/global-auth-id.type';

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
    private readonly orderTenantRepository: OrderTenantRepositoryPort,
    private readonly storeCustomerRepository: StoreCustomerRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
  ) {}

  async execute(dto: GenerateCommercialOrderDto): Promise<void> {
    await this.transactionManager.runInTransaction(
      async (tx: TransactionContext) => {
        const tenantData = await this.orderTenantRepository.findActiveBySlug(dto.tenantSlug, tx);
        if (!tenantData) {
          throw new TenantNotAvailableException();
        }
        const tenantId = tenantData.id;
        const customerAddress = Address.create(
          dto.shippingAddress.street,
          dto.shippingAddress.city,
          dto.shippingAddress.state,
          dto.shippingAddress.zipCode,
          dto.shippingAddress.country,
          dto.shippingAddress.reference
        );

        const customer = await this.storeCustomerRepository.resolveOrCreate({
          tenantId,
          globalAuthId: createGlobalAuthId(dto.buyerId),
          name: dto.customer.name,
          email: dto.customer.email,
          phone: dto.customer.phone,
          documentId: dto.customer.documentId,
          address: customerAddress
        }, tx);
        
        const customerId = createCustomerId(customer.getId());

        const orderItems: OrderItem[] = [];
        let subtotalAmount = 0;
        let currency = Currency.USD;

        for (const itemDto of dto.items) {
          const productId = createProductId(itemDto.productId);

          const product = await this.productRepository.findById(productId, tenantId, tx);

          if (!product) {
            throw new ProductUnavailableException();
          }

          if (product.getStatus() !== ProductStatus.ACTIVE) {
            throw new ProductUnavailableException();
          }

          if (product.getStock() < itemDto.quantity) {
            throw new ProductOutOfStockException();
          }

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

        const subtotal = Money.from(subtotalAmount, currency);
        const taxAmount = Money.from(0, currency);
        const discountAmount = Money.from(0, currency);
        const shippingCost = Money.from(0, currency);

        const shippingAddress = customerAddress;

        const orderId = createOrderId(crypto.randomUUID());
        const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;

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

        order.confirm();

        await this.orderRepository.save(order, tx);
      },
      { userId: dto.buyerId },
    );
  }
}

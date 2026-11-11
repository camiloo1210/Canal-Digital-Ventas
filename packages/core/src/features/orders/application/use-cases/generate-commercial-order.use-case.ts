import type { BuyerWholesalePort } from '@/iam/application/ports/out/buyer-wholesale.port';
import { OrderRepositoryPort } from '@/orders/application/ports/out/order-repository.port';
import { generateOrderNumber } from '@/orders/domain/value-objects/order-number.vo';
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
import { selectUnitPriceCents } from '@/shared/domain/unit-price.policy';
import { InvalidMoneyException } from '@/shared/domain/exceptions/invalid-money.exception';
import { InvalidQuantityException } from '@/orders/domain/exceptions/invalid-quantity.exception';
import { createOrderId } from '@/orders/domain/types/order-id.type';
import { createOrderItemId } from '@/orders/domain/types/order-item-id.type';
import { createCustomerId } from '@/orders/domain/types/customer-id.type';
import { createGlobalAuthId } from '@/sales/domain/types/global-auth-id.type';

import { createProductId } from '@/products/domain/types/product-id.type';
import { ProductStatus } from '@/products/domain/enums/product-status.enum';

import { ProductUnavailableException } from '@/products/application/exceptions/product-unavailable.exception';

export class GenerateCommercialOrderUseCase {
  constructor(
    private readonly orderRepository: OrderRepositoryPort,
    private readonly productRepository: ProductRepositoryPort,
    private readonly orderTenantRepository: OrderTenantRepositoryPort,
    private readonly storeCustomerRepository: StoreCustomerRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly buyerWholesale: BuyerWholesalePort,
  ) {}

  async execute(dto: GenerateCommercialOrderDto): Promise<void> {
    await this.transactionManager.runInTransaction(
      async (tx: TransactionContext): Promise<void> => {
        const tenantData = await this.orderTenantRepository.findActiveBySlug(dto.tenantSlug, tx);
        if (!tenantData) {
          throw new TenantNotAvailableException();
        }
        const tenantId = tenantData.id;
        const wholesaleEligible = await this.buyerWholesale.isEligible(dto.buyerId, tenantId, tx);
        const customerAddress = Address.create(
          dto.shippingAddress.street,
          dto.shippingAddress.city,
          dto.shippingAddress.state,
          dto.shippingAddress.zipCode,
          dto.shippingAddress.country,
          dto.shippingAddress.reference,
        );

        const customer = await this.storeCustomerRepository.resolveOrCreate(
          {
            tenantId,
            globalAuthId: createGlobalAuthId(dto.buyerId),
            name: dto.customer.name,
            email: dto.customer.email,
            phone: dto.customer.phone,
            documentId: dto.customer.documentId,
            address: customerAddress,
          },
          tx,
        );

        const customerId = createCustomerId(customer.getId());

        const orderItems: OrderItem[] = [];
        const currency = tenantData.currency;
        let subtotal = Money.from(0, currency);

        const consolidatedItemsMap = new Map<string, number>();
        for (const itemDto of dto.items) {
          if (!Number.isSafeInteger(itemDto.quantity) || itemDto.quantity <= 0) {
            throw new InvalidQuantityException();
          }
          const currentQty = consolidatedItemsMap.get(itemDto.productId) || 0;
          const quantity = currentQty + itemDto.quantity;
          if (!Number.isSafeInteger(quantity)) throw new InvalidQuantityException();
          consolidatedItemsMap.set(itemDto.productId, quantity);
        }

        const consolidatedItems = Array.from(consolidatedItemsMap.entries()).map(
          ([productId, quantity]): { productId: string; quantity: number } => ({
            productId,
            quantity,
          }),
        );

        consolidatedItems.sort((left, right): number =>
          left.productId.localeCompare(right.productId),
        );
        for (const itemDto of consolidatedItems) {
          const productId = createProductId(itemDto.productId);

          const product = await this.productRepository.findById(productId, tenantId, tx);

          if (!product) {
            throw new ProductUnavailableException();
          }

          if (product.getStatus() !== ProductStatus.ACTIVE) {
            throw new ProductUnavailableException();
          }

          product.decreaseStock(itemDto.quantity);
          await this.productRepository.decreaseStock(productId, tenantId, itemDto.quantity, tx);

          if (product.getPrice().getCurrency() !== currency) {
            throw new InvalidMoneyException('Product currency must match tenant currency.');
          }
          const wholesalePrice = product.getWholesalePrice();
          if (wholesalePrice !== null && wholesalePrice.getCurrency() !== currency) {
            throw new InvalidMoneyException('Wholesale price currency must match tenant currency.');
          }
          const authoritativePrice = selectUnitPriceCents(
            {
              retailPriceCents: product.getPrice().getValue(),
              wholesalePriceCents: wholesaleEligible ? (wholesalePrice?.getValue() ?? null) : null,
              wholesaleMinQuantity: product.getWholesaleMinQuantity(),
            },
            itemDto.quantity,
          );

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
          subtotal = subtotal.add(orderItem.getSubtotal());
        }

        const taxAmount = Money.from(0, currency);
        const discountAmount = Money.from(0, currency);
        const shippingCost = Money.from(0, currency);

        const shippingAddress = customerAddress;

        const orderId = createOrderId(crypto.randomUUID());
        const orderNumber = generateOrderNumber();

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

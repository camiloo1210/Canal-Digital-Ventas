import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CancelOrderUseCase } from './cancel-order.use-case';
import { OrderRepositoryPort } from '@/orders/application/ports/out/order-repository.port';
import { ProductRepositoryPort } from '@/products/application/ports/out/product-repository.port';
import { StoreCustomerRepositoryPort } from '@/sales/application/ports/out/store-customer-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import {
  TransactionManagerPort,
  TransactionContext,
} from '@/shared/application/ports/out/transaction-manager.port';
import { Order } from '@/orders/domain/entities/order.entity';
import { OrderStatus } from '@/orders/domain/enums/order-status.enum';
import { OrderNotFoundException } from '@/orders/application/exceptions/order-not-found.exception';
import { InvalidOrderStateException } from '@/orders/domain/exceptions/invalid-order-state.exception';
import { Money } from '@/shared/domain/value-objects/money.vo';
import { Currency } from '@/shared/domain/enums/currency.enum';
import { Address } from '@/shared/domain/value-objects/adress.vo';
import { OrderItem } from '@/orders/domain/entities/order-item.entity';
import { createOrderId } from '@/orders/domain/types/order-id.type';
import { createCustomerId } from '@/orders/domain/types/customer-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { createOrderItemId } from '@/orders/domain/types/order-item-id.type';
import { createProductId } from '@/products/domain/types/product-id.type';
import { StoreCustomer } from '@/sales/domain/entities/store-customer.entity';
import { StoreCustomerStatus } from '@/sales/domain/enums/store-customer-status.enum';

describe('CancelOrderUseCase Unit Tests', () => {
  let orderRepository: OrderRepositoryPort;
  let productRepository: ProductRepositoryPort;
  let storeCustomerRepository: StoreCustomerRepositoryPort;
  let eventBus: EventBusPort;
  let transactionManager: TransactionManagerPort;
  let useCase: CancelOrderUseCase;

  const mockTx: TransactionContext = {
    executeNative: vi.fn(),
  };

  const testTenantId = createTenantId(crypto.randomUUID());
  const testOrderId = createOrderId(crypto.randomUUID());
  const testCustomerId = createCustomerId(crypto.randomUUID());
  const testBuyerId = crypto.randomUUID();
  const testProductId = createProductId(crypto.randomUUID());

  function createTestOrder(status: OrderStatus): Order {
    const item = OrderItem.reconstitute({
      id: createOrderItemId(crypto.randomUUID()),
      productId: testProductId,
      variantId: null,
      productName: 'Gaming Mouse',
      sku: 'SKU-GM-01',
      unitPrice: Money.from(50, Currency.USD),
      quantity: 2,
      subtotal: Money.from(100, Currency.USD),
    });

    return Order.reconstitute({
      id: testOrderId,
      orderNumber: 'ORD-123456',
      customerId: testCustomerId,
      tenantId: testTenantId,
      items: [item],
      status,
      subtotal: Money.from(100, Currency.USD),
      taxAmount: Money.from(0, Currency.USD),
      discountAmount: Money.from(0, Currency.USD),
      shippingCost: Money.from(0, Currency.USD),
      totalAmount: Money.from(100, Currency.USD),
      shippingAddress: Address.create('Main St 123', 'City', 'State', '12345', 'US'),
      paymentGatewayId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 0,
    });
  }

  function createTestCustomer(): StoreCustomer {
    return StoreCustomer.reconstitute({
      id: testCustomerId as unknown as import('@/sales/domain/types/customer-id.type').StoreCustomerId,
      tenantId: testTenantId,
      globalAuthId:
        testBuyerId as unknown as import('@/sales/domain/types/global-auth-id.type').GlobalAuthId,
      name: 'John Doe',
      email: 'john@example.com',
      phone: '123456789',
      documentId: 'DOC123',
      address: Address.create('Main St 123', 'City', 'State', '12345', 'US'),
      status: StoreCustomerStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 0,
    });
  }

  beforeEach(() => {
    orderRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findPendingByCustomerId: vi.fn(),
      findAll: vi.fn(),
      searchByFilters: vi.fn(),
    };

    productRepository = {
      save: vi.fn(),
      delete: vi.fn(),
      decreaseStock: vi.fn(),
      increaseStock: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findAll: vi.fn(),
      searchByFilters: vi.fn(),
      findByCategoryId: vi.fn(),
      searchProductsByName: vi.fn(),
    };

    storeCustomerRepository = {
      resolveOrCreate: vi.fn(),
      findByGlobalAuthId: vi.fn(),
    };

    eventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
    };

    transactionManager = {
      runInTransaction: vi.fn().mockImplementation(async (callback) => callback(mockTx)),
    };

    useCase = new CancelOrderUseCase(
      orderRepository,
      productRepository,
      storeCustomerRepository,
      eventBus,
      transactionManager,
    );
  });

  it('debe cancelar exitosamente un pedido en estado CONFIRMED y restituir stock', async () => {
    const order = createTestOrder(OrderStatus.CONFIRMED);
    const customer = createTestCustomer();

    vi.mocked(orderRepository.findById).mockResolvedValue(order);
    vi.mocked(storeCustomerRepository.findByGlobalAuthId).mockResolvedValue(customer);

    await useCase.execute({
      orderId: testOrderId,
      authenticatedBuyerId: testBuyerId,
    });

    expect(order.getStatus()).toBe(OrderStatus.CANCELLED);
    expect(orderRepository.save).toHaveBeenCalledWith(order, mockTx);
    expect(productRepository.increaseStock).toHaveBeenCalledWith(
      testProductId,
      testTenantId,
      2,
      mockTx,
    );
    expect(eventBus.publish).toHaveBeenCalled();
  });

  it('debe cancelar exitosamente un pedido en estado PROCESSING y restituir stock', async () => {
    const order = createTestOrder(OrderStatus.PROCESSING);
    const customer = createTestCustomer();

    vi.mocked(orderRepository.findById).mockResolvedValue(order);
    vi.mocked(storeCustomerRepository.findByGlobalAuthId).mockResolvedValue(customer);

    await useCase.execute({
      orderId: testOrderId,
      authenticatedBuyerId: testBuyerId,
    });

    expect(order.getStatus()).toBe(OrderStatus.CANCELLED);
    expect(productRepository.increaseStock).toHaveBeenCalledWith(
      testProductId,
      testTenantId,
      2,
      mockTx,
    );
  });

  it('debe rechazar con InvalidOrderStateException si el pedido está en DRAFT', async () => {
    const order = createTestOrder(OrderStatus.DRAFT);
    const customer = createTestCustomer();

    vi.mocked(orderRepository.findById).mockResolvedValue(order);
    vi.mocked(storeCustomerRepository.findByGlobalAuthId).mockResolvedValue(customer);

    await expect(
      useCase.execute({
        orderId: testOrderId,
        authenticatedBuyerId: testBuyerId,
      }),
    ).rejects.toThrow(InvalidOrderStateException);

    expect(productRepository.increaseStock).not.toHaveBeenCalled();
    expect(orderRepository.save).not.toHaveBeenCalled();
  });

  it('debe rechazar con InvalidOrderStateException si el pedido está en SHIPPED o DELIVERED', async () => {
    const shippedOrder = createTestOrder(OrderStatus.SHIPPED);
    const customer = createTestCustomer();

    vi.mocked(orderRepository.findById).mockResolvedValue(shippedOrder);
    vi.mocked(storeCustomerRepository.findByGlobalAuthId).mockResolvedValue(customer);

    await expect(
      useCase.execute({
        orderId: testOrderId,
        authenticatedBuyerId: testBuyerId,
      }),
    ).rejects.toThrow(InvalidOrderStateException);

    expect(productRepository.increaseStock).not.toHaveBeenCalled();
  });

  it('debe rechazar con OrderNotFoundException si la orden no existe', async () => {
    vi.mocked(orderRepository.findById).mockResolvedValue(null);

    await expect(
      useCase.execute({
        orderId: testOrderId,
        authenticatedBuyerId: testBuyerId,
      }),
    ).rejects.toThrow(OrderNotFoundException);
  });

  it('Anti-IDOR: debe rechazar con OrderNotFoundException si el comprador no es el dueño', async () => {
    const order = createTestOrder(OrderStatus.CONFIRMED);
    // Otro cliente diferente
    const strangerCustomer = StoreCustomer.reconstitute({
      id: 'diff-id' as unknown as import('@/sales/domain/types/customer-id.type').StoreCustomerId,
      tenantId: testTenantId,
      globalAuthId:
        testBuyerId as unknown as import('@/sales/domain/types/global-auth-id.type').GlobalAuthId,
      name: 'Stranger',
      email: 'stranger@example.com',
      phone: '999999',
      documentId: 'DOC999',
      address: Address.create('Other St', 'City', 'State', '12345', 'US'),
      status: StoreCustomerStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 0,
    });

    vi.mocked(orderRepository.findById).mockResolvedValue(order);
    vi.mocked(storeCustomerRepository.findByGlobalAuthId).mockResolvedValue(strangerCustomer);

    await expect(
      useCase.execute({
        orderId: testOrderId,
        authenticatedBuyerId: testBuyerId,
      }),
    ).rejects.toThrow(OrderNotFoundException);

    expect(order.getStatus()).toBe(OrderStatus.CONFIRMED);
    expect(productRepository.increaseStock).not.toHaveBeenCalled();
    expect(orderRepository.save).not.toHaveBeenCalled();
  });
});

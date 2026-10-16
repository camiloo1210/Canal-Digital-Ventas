import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CancelOrderUseCase } from '@/orders/application/use-cases/cancel-order.use-case';
import type { OrderPaymentCoordinationPort } from '@/orders/application/ports/out/order-payment-coordination.port';
import type {
  OrderLifecycleRepositoryPort,
  OrderPaymentAutomationPort,
} from '@/orders/application/ports/out/order-payment-automation.port';
import { CancelExpiredOrderUseCase } from '@/orders/application/use-cases/cancel-expired-order.use-case';
import { MarkOrderPaidUseCase } from '@/orders/application/use-cases/mark-order-paid.use-case';
import { ApplyObservedRefundToOrderUseCase } from '@/orders/application/use-cases/apply-observed-refund-to-order.use-case';
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
  let paymentCoordination: OrderPaymentCoordinationPort;
  let lifecycle: OrderLifecycleRepositoryPort;
  let automation: OrderPaymentAutomationPort;

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

    paymentCoordination = { lockAndReadPayment: vi.fn().mockResolvedValue(null) };
    lifecycle = { findByIdForUpdate: vi.fn(), saveLifecycle: vi.fn().mockResolvedValue(undefined) };
    automation = {
      read: vi
        .fn()
        .mockResolvedValue({
          paymentId: 'payment',
          tenantId: testTenantId,
          status: 'expired_unpaid_awaiting_reconciliation',
          amountCents: 100,
          providerOrderId: '123',
          environment: 'test',
          excluded: false,
        }),
      reserveExpiryCancellation: vi.fn().mockResolvedValue(true),
    };
    useCase = new CancelOrderUseCase(
      orderRepository,
      productRepository,
      storeCustomerRepository,
      eventBus,
      transactionManager,
      paymentCoordination,
    );
  });

  it('cancels an expired confirmed order once with stock restoration in the same transaction', async (): Promise<void> => {
    const order = createTestOrder(OrderStatus.CONFIRMED);
    vi.mocked(lifecycle.findByIdForUpdate).mockResolvedValue(order);
    const expiry = new CancelExpiredOrderUseCase(
      lifecycle,
      productRepository,
      paymentCoordination,
      automation,
      eventBus,
      transactionManager,
      testBuyerId,
    );
    expect(
      await expiry.execute({ orderId: testOrderId, tenantId: testTenantId, paymentId: 'payment' }),
    ).toBe('APPLIED');
    expect(order.getStatus()).toBe(OrderStatus.CANCELLED);
    expect(automation.reserveExpiryCancellation).toHaveBeenCalledWith(
      testOrderId,
      'payment',
      testTenantId,
      mockTx,
    );
    expect(productRepository.increaseStock).toHaveBeenCalledWith(
      testProductId,
      testTenantId,
      2,
      mockTx,
    );
    expect(lifecycle.saveLifecycle).toHaveBeenCalledWith(order, mockTx);
    expect(eventBus.publish).toHaveBeenCalled();
    expect(
      await expiry.execute({ orderId: testOrderId, tenantId: testTenantId, paymentId: 'payment' }),
    ).toBe('NOOP');
    expect(productRepository.increaseStock).toHaveBeenCalledTimes(1);
  });

  it('does not restore inventory when another expiry transaction owns the unique record', async (): Promise<void> => {
    vi.mocked(lifecycle.findByIdForUpdate).mockResolvedValue(
      createTestOrder(OrderStatus.CONFIRMED),
    );
    vi.mocked(automation.reserveExpiryCancellation).mockResolvedValue(false);
    const expiry = new CancelExpiredOrderUseCase(
      lifecycle,
      productRepository,
      paymentCoordination,
      automation,
      eventBus,
      transactionManager,
      testBuyerId,
    );
    expect(
      await expiry.execute({ orderId: testOrderId, tenantId: testTenantId, paymentId: 'payment' }),
    ).toBe('NOOP');
    expect(productRepository.increaseStock).not.toHaveBeenCalled();
    expect(lifecycle.saveLifecycle).not.toHaveBeenCalled();
  });

  it.each([
    OrderStatus.PENDING_PAYMENT,
    OrderStatus.PAID,
    OrderStatus.PROCESSING,
    OrderStatus.CANCELLED,
  ])('never expires an order in %s', async (status: OrderStatus): Promise<void> => {
    vi.mocked(lifecycle.findByIdForUpdate).mockResolvedValue(createTestOrder(status));
    const expiry = new CancelExpiredOrderUseCase(
      lifecycle,
      productRepository,
      paymentCoordination,
      automation,
      eventBus,
      transactionManager,
      testBuyerId,
    );
    expect(
      await expiry.execute({ orderId: testOrderId, tenantId: testTenantId, paymentId: 'payment' }),
    ).toBe('NOOP');
    expect(automation.reserveExpiryCancellation).not.toHaveBeenCalled();
    expect(productRepository.increaseStock).not.toHaveBeenCalled();
  });

  it('rejects an event naming the wrong payment without touching inventory', async (): Promise<void> => {
    vi.mocked(lifecycle.findByIdForUpdate).mockResolvedValue(
      createTestOrder(OrderStatus.CONFIRMED),
    );
    const expiry = new CancelExpiredOrderUseCase(
      lifecycle,
      productRepository,
      paymentCoordination,
      automation,
      eventBus,
      transactionManager,
      testBuyerId,
    );
    expect(
      await expiry.execute({ orderId: testOrderId, tenantId: testTenantId, paymentId: 'other' }),
    ).toBe('MISMATCH');
    expect(productRepository.increaseStock).not.toHaveBeenCalled();
  });

  it('marks a corroborated completed payment paid and treats redelivery as a no-op', async (): Promise<void> => {
    const order = createTestOrder(OrderStatus.CONFIRMED);
    vi.mocked(lifecycle.findByIdForUpdate).mockResolvedValue(order);
    vi.mocked(automation.read).mockResolvedValue({
      paymentId: 'payment',
      tenantId: testTenantId,
      status: 'completed',
      amountCents: 100,
      providerOrderId: '123',
      environment: 'test',
      excluded: false,
    });
    const paid = new MarkOrderPaidUseCase(
      lifecycle,
      paymentCoordination,
      automation,
      eventBus,
      transactionManager,
      testBuyerId,
    );
    expect(
      await paid.execute({ orderId: testOrderId, tenantId: testTenantId, paymentId: 'payment' }),
    ).toBe('APPLIED');
    expect(order.getStatus()).toBe(OrderStatus.PAID);
    expect(order.getPaymentGatewayId()).toBe('123');
    expect(
      await paid.execute({ orderId: testOrderId, tenantId: testTenantId, paymentId: 'payment' }),
    ).toBe('NOOP');
    expect(lifecycle.saveLifecycle).toHaveBeenCalledTimes(1);
  });

  it('blocks cancellation after the payment settles, even before the order consumer marks it paid', async (): Promise<void> => {
    const order = createTestOrder(OrderStatus.CONFIRMED);
    vi.mocked(orderRepository.findById).mockResolvedValue(order);
    vi.mocked(storeCustomerRepository.findByGlobalAuthId).mockResolvedValue(createTestCustomer());
    vi.mocked(paymentCoordination.lockAndReadPayment).mockResolvedValue({
      paymentId: 'payment',
      status: 'completed',
    });
    await expect(
      useCase.execute({ orderId: testOrderId, authenticatedBuyerId: testBuyerId }),
    ).rejects.toThrow(InvalidOrderStateException);
    expect(orderRepository.save).not.toHaveBeenCalled();
    expect(productRepository.increaseStock).not.toHaveBeenCalled();
    expect(order.getStatus()).toBe(OrderStatus.CONFIRMED);
  });

  it.each([
    OrderStatus.CONFIRMED,
    OrderStatus.PAID,
    OrderStatus.PROCESSING,
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
  ])(
    'applies an observed full refund to %s once without inventory changes',
    async (status: OrderStatus): Promise<void> => {
      const order = createTestOrder(status);
      vi.mocked(lifecycle.findByIdForUpdate).mockResolvedValue(order);
      vi.mocked(automation.read).mockResolvedValue({
        paymentId: 'payment',
        tenantId: testTenantId,
        status: 'refunded',
        amountCents: 100,
        providerOrderId: '123',
        environment: 'test',
        excluded: false,
      });
      const refund = new ApplyObservedRefundToOrderUseCase(
        lifecycle,
        paymentCoordination,
        automation,
        eventBus,
        transactionManager,
        testBuyerId,
      );
      expect(
        await refund.execute({
          orderId: testOrderId,
          tenantId: testTenantId,
          paymentId: 'payment',
        }),
      ).toBe('APPLIED');
      expect(order.getStatus()).toBe(OrderStatus.REFUNDED);
      expect(order.getPaymentGatewayId()).toBe('123');
      expect(
        await refund.execute({
          orderId: testOrderId,
          tenantId: testTenantId,
          paymentId: 'payment',
        }),
      ).toBe('NOOP');
      expect(lifecycle.saveLifecycle).toHaveBeenCalledTimes(1);
      expect(productRepository.increaseStock).not.toHaveBeenCalled();
    },
  );
  it('does not resurrect a cancelled order after late-payment compensation', async (): Promise<void> => {
    const order = createTestOrder(OrderStatus.CANCELLED);
    vi.mocked(lifecycle.findByIdForUpdate).mockResolvedValue(order);
    vi.mocked(automation.read).mockResolvedValue({
      paymentId: 'payment',
      tenantId: testTenantId,
      status: 'refunded',
      amountCents: 100,
      providerOrderId: '123',
      environment: 'test',
      excluded: false,
    });
    const refund = new ApplyObservedRefundToOrderUseCase(
      lifecycle,
      paymentCoordination,
      automation,
      eventBus,
      transactionManager,
      testBuyerId,
    );
    expect(
      await refund.execute({ orderId: testOrderId, tenantId: testTenantId, paymentId: 'payment' }),
    ).toBe('NOOP');
    expect(order.getStatus()).toBe(OrderStatus.CANCELLED);
    expect(lifecycle.saveLifecycle).not.toHaveBeenCalled();
    expect(productRepository.increaseStock).not.toHaveBeenCalled();
  });
  it('does not mark an order fully refunded from a partial refund', async (): Promise<void> => {
    const order = createTestOrder(OrderStatus.PAID);
    vi.mocked(lifecycle.findByIdForUpdate).mockResolvedValue(order);
    vi.mocked(automation.read).mockResolvedValue({
      paymentId: 'payment',
      tenantId: testTenantId,
      status: 'partially_refunded',
      amountCents: 100,
      providerOrderId: '123',
      environment: 'test',
      excluded: false,
    });
    const refund = new ApplyObservedRefundToOrderUseCase(
      lifecycle,
      paymentCoordination,
      automation,
      eventBus,
      transactionManager,
      testBuyerId,
    );
    expect(
      await refund.execute({ orderId: testOrderId, tenantId: testTenantId, paymentId: 'payment' }),
    ).toBe('NOOP');
    expect(lifecycle.saveLifecycle).not.toHaveBeenCalled();
  });
  it('accepts a completed-payment event arriving after a partial refund', async (): Promise<void> => {
    const order = createTestOrder(OrderStatus.CONFIRMED);
    vi.mocked(lifecycle.findByIdForUpdate).mockResolvedValue(order);
    vi.mocked(automation.read).mockResolvedValue({
      paymentId: 'payment',
      tenantId: testTenantId,
      status: 'partially_refunded',
      amountCents: 100,
      providerOrderId: '123',
      environment: 'test',
      excluded: false,
    });
    const paid = new MarkOrderPaidUseCase(
      lifecycle,
      paymentCoordination,
      automation,
      eventBus,
      transactionManager,
      testBuyerId,
    );
    expect(
      await paid.execute({ orderId: testOrderId, tenantId: testTenantId, paymentId: 'payment' }),
    ).toBe('APPLIED');
    expect(order.getStatus()).toBe(OrderStatus.PAID);
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

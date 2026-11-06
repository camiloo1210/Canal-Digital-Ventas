import { describe, expect, it, vi } from 'vitest';
import { GenerateCommercialOrderUseCase } from '@/orders/application/use-cases/generate-commercial-order.use-case';
import type { GenerateCommercialOrderDto } from '@/orders/application/dtos/generate-commercial-order.dto';
import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import { Product } from '@/products/domain/entities/product.entity';
import { ProductName } from '@/products/domain/value-objects/product-name.vo';
import { Sku } from '@/products/domain/value-objects/sku.vo';
import { ProductStatus } from '@/products/domain/enums/product-status.enum';
import { createProductId } from '@/products/domain/types/product-id.type';
import { createCategoryId } from '@/products/domain/types/category-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { StoreCustomer } from '@/sales/domain/entities/store-customer.entity';
import { createStoreCustomerId } from '@/sales/domain/types/customer-id.type';
import { createGlobalAuthId } from '@/sales/domain/types/global-auth-id.type';
import { Address } from '@/shared/domain/value-objects/adress.vo';
import { Money, MAX_MONEY_CENTS } from '@/shared/domain/value-objects/money.vo';
import { Currency } from '@/shared/domain/enums/currency.enum';
import { Order } from '@/orders/domain/entities/order.entity';

const tenantId = createTenantId('tenant');
function product(id: string, amount: number, currency: Currency = Currency.COP): Product {
  return Product.create(
    createProductId(id),
    ProductName.from('Product'),
    Money.from(amount, currency),
    Money.from(0, currency),
    'Description',
    100,
    createCategoryId('category'),
    Sku.from('SKU-01'),
    tenantId,
    null,
    ProductStatus.ACTIVE,
    [],
    null,
    [],
    false,
    null,
    null,
  );
}
function dto(items: GenerateCommercialOrderDto['items']): GenerateCommercialOrderDto {
  return {
    buyerId: 'buyer',
    tenantSlug: 'store',
    items,
    customer: { name: 'Buyer', email: 'buyer@example.com', phone: '12345', documentId: 'DOC' },
    shippingAddress: {
      street: 'Street',
      city: 'City',
      state: 'State',
      zipCode: '123',
      country: 'CO',
    },
  };
}
function fixture(products: Product[]): {
  useCase: GenerateCommercialOrderUseCase;
  save: ReturnType<typeof vi.fn<(order: Order) => Promise<void>>>;
  decreaseStock: ReturnType<typeof vi.fn>;
} {
  const save = vi.fn<(order: Order) => Promise<void>>().mockResolvedValue(undefined);
  const decreaseStock = vi.fn().mockResolvedValue(undefined);
  const customer = StoreCustomer.create(
    createStoreCustomerId('customer'),
    tenantId,
    createGlobalAuthId('buyer'),
    'Buyer',
    'buyer@example.com',
    '12345',
    'DOC',
    Address.create('Street', 'City', 'State', '123', 'CO'),
  );
  return {
    save,
    decreaseStock,
    useCase: new GenerateCommercialOrderUseCase(
      {
        save,
        findById: vi.fn(),
        findPendingByCustomerId: vi.fn(),
        findAll: vi.fn(),
        searchByFilters: vi.fn(),
      },
      {
        save: vi.fn(),
        delete: vi.fn(),
        findById: vi.fn(
          async (id: string): Promise<Product | null> =>
            products.find((candidate: Product): boolean => candidate.getId() === id) ?? null,
        ),
        decreaseStock,
        increaseStock: vi.fn(),
        findAll: vi.fn(),
        searchByFilters: vi.fn(),
        findByCategoryId: vi.fn(),
        searchProductsByName: vi.fn(),
      },
      { findActiveBySlug: vi.fn().mockResolvedValue({ id: tenantId, currency: Currency.COP }) },
      { resolveOrCreate: vi.fn().mockResolvedValue(customer), findByGlobalAuthId: vi.fn() },
      {
        runInTransaction: async <T>(work: (tx: TransactionContext) => Promise<T>): Promise<T> =>
          work({ executeNative: vi.fn() }),
      },
    ),
  };
}

describe('Commercial checkout monetary authority', (): void => {
  it('consolidates quantities and persists exact tenant-currency line and order totals', async (): Promise<void> => {
    const h = fixture([product('product', 125)]);
    await h.useCase.execute(
      dto([
        { productId: 'product', quantity: 2 },
        { productId: 'product', quantity: 3 },
      ]),
    );
    const order = h.save.mock.calls[0][0];
    expect(order.getSubtotal().getValue()).toBe(625);
    expect(order.getTotalAmount().getCurrency()).toBe(Currency.COP);
    expect(order.getItems()[0].getQuantity()).toBe(5);
    expect(h.decreaseStock).toHaveBeenCalledTimes(1);
  });
  it('uses consolidated quantities to cross the wholesale threshold', async (): Promise<void> => {
    const catalogProduct = product('product', 125);
    catalogProduct.changeWholesaleRules(Money.from(80, Currency.COP), 5);
    const h = fixture([catalogProduct]);
    await h.useCase.execute(
      dto([
        { productId: 'product', quantity: 2 },
        { productId: 'product', quantity: 3 },
      ]),
    );
    const order = h.save.mock.calls[0][0];
    expect(order.getItems()[0].getUnitPrice().getValue()).toBe(80);
    expect(order.getSubtotal().getValue()).toBe(400);
  });
  it('does not persist a cart sum exceeding the commercial limit', async (): Promise<void> => {
    const h = fixture([product('a', MAX_MONEY_CENTS), product('b', 1)]);
    await expect(
      h.useCase.execute(
        dto([
          { productId: 'a', quantity: 1 },
          { productId: 'b', quantity: 1 },
        ]),
      ),
    ).rejects.toThrow();
    expect(h.save).not.toHaveBeenCalled();
  });
  it('rejects mixed currencies instead of relabeling prices', async (): Promise<void> => {
    const h = fixture([product('a', 100), product('b', 100, Currency.USD)]);
    await expect(
      h.useCase.execute(
        dto([
          { productId: 'a', quantity: 1 },
          { productId: 'b', quantity: 1 },
        ]),
      ),
    ).rejects.toThrow();
    expect(h.save).not.toHaveBeenCalled();
  });
  it('rejects unsafe consolidated quantities before touching inventory', async (): Promise<void> => {
    const h = fixture([product('product', 1)]);
    await expect(
      h.useCase.execute(
        dto([
          { productId: 'product', quantity: Number.MAX_SAFE_INTEGER },
          { productId: 'product', quantity: 1 },
        ]),
      ),
    ).rejects.toThrow();
    expect(h.decreaseStock).not.toHaveBeenCalled();
    expect(h.save).not.toHaveBeenCalled();
  });
  it.each([NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects unsafe quantities %s',
    async (quantity: number): Promise<void> => {
      const h = fixture([product('product', 1)]);
      await expect(h.useCase.execute(dto([{ productId: 'product', quantity }]))).rejects.toThrow();
      expect(h.decreaseStock).not.toHaveBeenCalled();
      expect(h.save).not.toHaveBeenCalled();
    },
  );
});

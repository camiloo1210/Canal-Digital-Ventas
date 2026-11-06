import type {
  BuyerCartRecord,
  BuyerCartRepositoryPort,
  SaveBuyerCartParams,
} from '@/carts/application/ports/out/buyer-cart-repository.port';
import type {
  BuyerCartCatalogProduct,
  BuyerCartCatalogReadPort,
} from '@/carts/application/ports/out/buyer-cart-catalog-read.port';
import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';
import { BuyerCartWriteConflictException } from '@/carts/application/exceptions/buyer-cart-write-conflict.exception';

export const TENANT_ID = '11111111-1111-4111-8111-111111111111';
export const TENANT_SLUG = 'tienda';
export const USER_ID = '22222222-2222-4222-8222-222222222222';
export const NOW = new Date('2026-11-03T12:00:00.000Z');

export function productId(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

export function catalogProduct(
  n: number,
  overrides: Partial<BuyerCartCatalogProduct> = {},
): BuyerCartCatalogProduct {
  return {
    productId: productId(n),
    name: `Product ${n}`,
    sku: `SKU-${n}`,
    unitPriceCents: 1000 + n,
    currency: 'COP',
    wholesalePriceCents: null,
    wholesaleMinQuantity: null,
    availableQuantity: 500,
    imageUrl: null,
    ...overrides,
  };
}

export class FakeCatalog implements BuyerCartCatalogReadPort {
  public readonly lookups: string[][] = [];
  public products: BuyerCartCatalogProduct[] = [];

  async findActiveTenantIdBySlug(tenantSlug: string): Promise<string | null> {
    return tenantSlug === TENANT_SLUG ? TENANT_ID : null;
  }

  async findProducts(tenantId: string, productIds: string[]): Promise<BuyerCartCatalogProduct[]> {
    this.lookups.push(productIds);
    if (tenantId !== TENANT_ID) return [];
    return this.products.filter((product: BuyerCartCatalogProduct): boolean =>
      productIds.includes(product.productId),
    );
  }
}

export class FakeBuyerCartRepository implements BuyerCartRepositoryPort {
  public readonly carts = new Map<string, BuyerCartRecord & { status: string }>();
  public readonly locks: boolean[] = [];
  public failNextSaveWithConflict = false;
  public touches = 0;
  public saves = 0;

  private key(tenantId: string, buyerUserId: string): string {
    return `${tenantId}:${buyerUserId}`;
  }

  seed(record: BuyerCartRecord): void {
    this.carts.set(this.key(record.tenantId, record.buyerUserId), { ...record, status: 'active' });
  }

  async findActive(
    params: { tenantId: string; buyerUserId: string },
    tx?: TransactionContext,
  ): Promise<BuyerCartRecord | null> {
    this.locks.push(tx !== undefined);
    const cart = this.carts.get(this.key(params.tenantId, params.buyerUserId));
    return cart && cart.status === 'active' ? { ...cart, lines: [...cart.lines] } : null;
  }

  async save(params: SaveBuyerCartParams): Promise<number> {
    if (this.failNextSaveWithConflict) {
      this.failNextSaveWithConflict = false;
      throw new BuyerCartWriteConflictException();
    }
    this.saves += 1;
    const key = this.key(params.tenantId, params.buyerUserId);
    const existing = this.carts.get(key);
    if (params.existingCartId === null && existing) throw new BuyerCartWriteConflictException();
    if (params.existingCartId !== null && existing?.version !== params.expectedVersion) {
      throw new BuyerCartWriteConflictException();
    }
    const version = (existing?.version ?? 0) + 1;
    this.carts.set(key, {
      id: existing?.id ?? 'cart-1',
      tenantId: params.tenantId,
      buyerUserId: params.buyerUserId,
      lines: params.lines,
      version,
      updatedAt: params.now,
      expiresAt: params.expiresAt,
      status: 'active',
    });
    return version;
  }

  async touch(params: {
    tenantId: string;
    buyerUserId: string;
    now: Date;
    expiresAt: Date;
  }): Promise<void> {
    this.touches += 1;
    const cart = this.carts.get(this.key(params.tenantId, params.buyerUserId));
    if (cart) {
      cart.expiresAt = params.expiresAt;
      cart.updatedAt = params.now;
    }
  }

  async markConverted(params: { tenantId: string; buyerUserId: string }): Promise<void> {
    const cart = this.carts.get(this.key(params.tenantId, params.buyerUserId));
    if (cart && cart.status === 'active') {
      cart.status = 'converted';
      cart.version += 1;
    }
  }
}

export class FakeTransactionManager implements TransactionManagerPort {
  public readonly calls: { userId: string; tenantId?: string }[] = [];

  async runInTransaction<T>(
    operation: (tx: TransactionContext) => Promise<T>,
    options: { userId: string; tenantId?: string },
  ): Promise<T> {
    this.calls.push(options);
    const tx: TransactionContext = {
      executeNative: async <TConnection, TResult>(
        callback: (conn: TConnection) => Promise<TResult>,
      ): Promise<TResult> => callback(undefined as unknown as TConnection),
    };
    return operation(tx);
  }
}

export interface Harness {
  catalog: FakeCatalog;
  carts: FakeBuyerCartRepository;
  transactions: FakeTransactionManager;
  clock: { now: Date };
}

export function harness(products: BuyerCartCatalogProduct[]): Harness {
  const catalog = new FakeCatalog();
  catalog.products = products;
  return {
    catalog,
    carts: new FakeBuyerCartRepository(),
    transactions: new FakeTransactionManager(),
    clock: { now: NOW },
  };
}

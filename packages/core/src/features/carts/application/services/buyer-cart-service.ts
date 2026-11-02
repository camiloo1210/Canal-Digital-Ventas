import { buyerCartExpiryFrom } from '@/carts/domain/policies/buyer-cart-limits';
import type { BuyerCartCatalogReadPort } from '@/carts/application/ports/out/buyer-cart-catalog-read.port';
import type {
  BuyerCartRecord,
  BuyerCartRepositoryPort,
  BuyerCartStoredLine,
} from '@/carts/application/ports/out/buyer-cart-repository.port';
import type {
  BuyerCartReadModel,
  BuyerCartSyncResult,
} from '@/carts/application/read-models/buyer-cart.read-model';
import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';
import {
  catalogMap,
  dedupeCandidates,
  lookupIds,
  normalizeBuyerCart,
  sameStoredLines,
  toStoredLines,
  type CartLineCandidate,
  type NormalizedBuyerCart,
} from '@/carts/application/services/buyer-cart-normalizer';
import { BuyerCartStoreNotFoundException } from '@/carts/application/exceptions/buyer-cart-store-not-found.exception';
import { BuyerCartWriteConflictException } from '@/carts/application/exceptions/buyer-cart-write-conflict.exception';
import { CartVersionConflictException } from '@/carts/application/exceptions/cart-version-conflict.exception';
import { InvalidBuyerCartInputException } from '@/carts/application/exceptions/invalid-buyer-cart-input.exception';

export type Clock = () => Date;

export function defaultClock(): Date {
  return new Date();
}

export function assertBuyerCartIdentity(userId: string, scope: string): void {
  if (typeof userId !== 'string' || userId.trim().length === 0) {
    throw new InvalidBuyerCartInputException('An authenticated user is required.');
  }
  if (typeof scope !== 'string' || scope.trim().length === 0) {
    throw new InvalidBuyerCartInputException('A store is required.');
  }
}

/** Shared orchestration of the buyer cart use cases (normalization, locking, sliding expiry). */
export class BuyerCartService {
  constructor(
    private readonly carts: BuyerCartRepositoryPort,
    private readonly catalog: BuyerCartCatalogReadPort,
    private readonly transactions: TransactionManagerPort,
    public readonly clock: Clock,
  ) {}

  public async requireTenantId(tenantSlug: string): Promise<string> {
    const tenantId = await this.catalog.findActiveTenantIdBySlug(tenantSlug);
    if (!tenantId) throw new BuyerCartStoreNotFoundException();
    return tenantId;
  }

  /** A cart past its expiry behaves as if it did not exist. */
  public isLive(record: BuyerCartRecord | null, now: Date): record is BuyerCartRecord {
    return record !== null && record.expiresAt.getTime() > now.getTime();
  }

  public async normalize(
    tenantId: string,
    candidates: readonly CartLineCandidate[],
  ): Promise<NormalizedBuyerCart> {
    const deduped = dedupeCandidates(candidates);
    const products = await this.catalog.findProducts(tenantId, lookupIds(deduped));
    return normalizeBuyerCart(deduped, catalogMap(products));
  }

  public emptyCart(now: Date): BuyerCartReadModel {
    return {
      items: [],
      version: 0,
      updatedAt: now.toISOString(),
      expiresAt: buyerCartExpiryFrom(now).toISOString(),
    };
  }

  /** The stored cart as the buyer would see it today (current catalog data and stock). */
  public async viewOf(
    tenantId: string,
    record: BuyerCartRecord | null,
    now: Date,
  ): Promise<BuyerCartReadModel> {
    if (!this.isLive(record, now)) return this.emptyCart(now);
    const { items } = await this.normalize(
      tenantId,
      record.lines.map((line: BuyerCartStoredLine): CartLineCandidate => ({
        productId: line.productId,
        quantity: line.quantity,
      })),
    );
    return {
      items,
      version: record.version,
      updatedAt: record.updatedAt.toISOString(),
      expiresAt: record.expiresAt.toISOString(),
    };
  }

  /**
   * Persists the normalized snapshot for the buyer inside one transaction. `guard` runs under the
   * row lock and may reject the write (optimistic concurrency); `resolve` produces the snapshot
   * from the locked state (merge needs it).
   */
  public async persist(params: {
    userId: string;
    tenantId: string;
    resolve: (live: BuyerCartRecord | null) => Promise<NormalizedBuyerCart>;
    guard?: (live: BuyerCartRecord | null, now: Date) => Promise<void>;
  }): Promise<BuyerCartSyncResult> {
    const now = this.clock();
    const expiresAt = buyerCartExpiryFrom(now);
    return this.transactions.runInTransaction(
      async (tx: TransactionContext): Promise<BuyerCartSyncResult> => {
        const identity = { tenantId: params.tenantId, buyerUserId: params.userId };
        const stored = await this.carts.findActive(identity, tx);
        const live = this.isLive(stored, now) ? stored : null;
        if (params.guard) await params.guard(live, now);
        const { items, dropped } = await params.resolve(live);
        const lines = toStoredLines(items);

        if (live && sameStoredLines(live.lines, lines)) {
          await this.carts.touch({ ...identity, cartId: live.id, now, expiresAt }, tx);
          return {
            cart: {
              items,
              version: live.version,
              updatedAt: now.toISOString(),
              expiresAt: expiresAt.toISOString(),
            },
            dropped,
          };
        }
        if (!stored && lines.length === 0) {
          return { cart: this.emptyCart(now), dropped };
        }
        try {
          const version = await this.carts.save(
            {
              ...identity,
              existingCartId: stored?.id ?? null,
              expectedVersion: stored?.version ?? 0,
              lines,
              now,
              expiresAt,
            },
            tx,
          );
          return {
            cart: {
              items,
              version,
              updatedAt: now.toISOString(),
              expiresAt: expiresAt.toISOString(),
            },
            dropped,
          };
        } catch (error: unknown) {
          if (error instanceof BuyerCartWriteConflictException) {
            const current = await this.carts.findActive(identity, tx);
            throw new CartVersionConflictException(
              await this.viewOf(params.tenantId, current, now),
            );
          }
          throw error;
        }
      },
      { userId: params.userId, tenantId: params.tenantId },
    );
  }
}

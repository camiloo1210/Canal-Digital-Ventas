import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';

export interface BuyerCartStoredLine {
  productId: string;
  name: string;
  sku: string;
  unitPriceCents: number;
  quantity: number;
}

export interface BuyerCartRecord {
  id: string;
  tenantId: string;
  buyerUserId: string;
  lines: BuyerCartStoredLine[];
  version: number;
  updatedAt: Date;
  expiresAt: Date;
}

export interface SaveBuyerCartParams {
  tenantId: string;
  buyerUserId: string;
  /** Id of the existing active row to overwrite, or null to create the buyer's cart. */
  existingCartId: string | null;
  /** Version read under lock; ignored when creating. */
  expectedVersion: number;
  lines: BuyerCartStoredLine[];
  now: Date;
  expiresAt: Date;
}

export interface BuyerCartRepositoryPort {
  /** Active cart of the buyer in the tenant. With a transaction the row is locked FOR UPDATE. */
  findActive(
    params: { tenantId: string; buyerUserId: string },
    tx?: TransactionContext,
  ): Promise<BuyerCartRecord | null>;

  /** Replaces the lines and bumps the version; returns the new version. */
  save(params: SaveBuyerCartParams, tx: TransactionContext): Promise<number>;

  /** Slides the expiry without changing content or version. */
  touch(
    params: { tenantId: string; buyerUserId: string; cartId: string; now: Date; expiresAt: Date },
    tx: TransactionContext,
  ): Promise<void>;

  markConverted(
    params: { tenantId: string; buyerUserId: string; now: Date },
    tx: TransactionContext,
  ): Promise<void>;
}

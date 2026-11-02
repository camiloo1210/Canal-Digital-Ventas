import { randomUUID } from 'node:crypto';
import type postgres from 'postgres';
import type {
  BuyerCartRecord,
  BuyerCartRepositoryPort,
  BuyerCartStoredLine,
  SaveBuyerCartParams,
} from '@/carts/application/ports/out/buyer-cart-repository.port';
import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import { BuyerCartRepositoryException } from '@/carts/application/exceptions/buyer-cart-repository.exception';
import { BuyerCartWriteConflictException } from '@/carts/application/exceptions/buyer-cart-write-conflict.exception';

type Connection =
  postgres.Sql<Record<string, unknown>> | postgres.TransactionSql<Record<string, unknown>>;

interface CartRow {
  id: string;
  version: number;
  updated_at: Date;
  expires_at: Date;
}

interface LineRow {
  product_id: string;
  product_name: string;
  sku: string;
  unit_price_cents: number;
  quantity: number;
}

export class PostgresBuyerCartRepository implements BuyerCartRepositoryPort {
  constructor(private readonly sql: postgres.Sql<Record<string, unknown>>) {}

  private run<T>(
    tx: TransactionContext | undefined,
    operation: (conn: Connection) => Promise<T>,
  ): Promise<T> {
    if (tx) return tx.executeNative<postgres.TransactionSql<Record<string, unknown>>, T>(operation);
    return operation(this.sql);
  }

  public async findActive(
    params: { tenantId: string; buyerUserId: string },
    tx?: TransactionContext,
  ): Promise<BuyerCartRecord | null> {
    try {
      return await this.run(tx, async (conn: Connection): Promise<BuyerCartRecord | null> => {
        // Inside a transaction the row is locked so concurrent writers serialize per buyer.
        const carts = tx
          ? await conn<CartRow[]>`
              SELECT c.id, c.version, c.updated_at, c.expires_at
              FROM sales.carts c
              WHERE c.tenant_id = ${params.tenantId}
                AND c.buyer_user_id = ${params.buyerUserId}
                AND c.status = 'active'
              LIMIT 1
              FOR UPDATE`
          : await conn<CartRow[]>`
              SELECT c.id, c.version, c.updated_at, c.expires_at
              FROM sales.carts c
              WHERE c.tenant_id = ${params.tenantId}
                AND c.buyer_user_id = ${params.buyerUserId}
                AND c.status = 'active'
              LIMIT 1`;
        const cart = carts[0];
        if (!cart) return null;
        const lines = await conn<LineRow[]>`
          SELECT i.product_id, i.product_name, i.sku, i.unit_price_cents, i.quantity
          FROM sales.cart_items i
          JOIN sales.carts c ON c.id = i.cart_id
          WHERE c.id = ${cart.id}
            AND c.tenant_id = ${params.tenantId}
            AND c.buyer_user_id = ${params.buyerUserId}
          ORDER BY i.position, i.id`;
        return {
          id: cart.id,
          tenantId: params.tenantId,
          buyerUserId: params.buyerUserId,
          lines: lines.map((line: LineRow): BuyerCartStoredLine => ({
            productId: line.product_id,
            name: line.product_name,
            sku: line.sku,
            unitPriceCents: Number(line.unit_price_cents),
            quantity: Number(line.quantity),
          })),
          version: Number(cart.version),
          updatedAt: new Date(cart.updated_at),
          expiresAt: new Date(cart.expires_at),
        };
      });
    } catch (error: unknown) {
      throw new BuyerCartRepositoryException('Failed to read the buyer cart.', error);
    }
  }

  public async save(params: SaveBuyerCartParams, tx: TransactionContext): Promise<number> {
    const subtotal = params.lines.reduce(
      (sum: number, line: BuyerCartStoredLine): number => sum + line.unitPriceCents * line.quantity,
      0,
    );
    if (!Number.isSafeInteger(subtotal)) {
      throw new BuyerCartRepositoryException('Cart subtotal exceeds the supported range.');
    }
    try {
      return await this.run(tx, async (conn: Connection): Promise<number> => {
        let cartId: string;
        let version: number;
        if (params.existingCartId === null) {
          cartId = randomUUID();
          const created = await conn<{ id: string }[]>`
            INSERT INTO sales.carts (
              id, tenant_id, customer_id, buyer_user_id, status,
              subtotal_cents, expires_at, created_at, updated_at, version
            ) VALUES (
              ${cartId}, ${params.tenantId}, NULL, ${params.buyerUserId}, 'active',
              ${subtotal}, ${params.expiresAt}, ${params.now}, ${params.now}, 1
            )
            ON CONFLICT (tenant_id, buyer_user_id)
              WHERE status = 'active' AND buyer_user_id IS NOT NULL
            DO NOTHING
            RETURNING id`;
          if (created.length === 0) throw new BuyerCartWriteConflictException();
          version = 1;
        } else {
          cartId = params.existingCartId;
          const updated = await conn<{ version: number }[]>`
            UPDATE sales.carts
            SET subtotal_cents = ${subtotal},
                expires_at = ${params.expiresAt},
                updated_at = ${params.now},
                version = version + 1
            WHERE id = ${cartId}
              AND tenant_id = ${params.tenantId}
              AND buyer_user_id = ${params.buyerUserId}
              AND status = 'active'
              AND version = ${params.expectedVersion}
            RETURNING version`;
          if (updated.length === 0) throw new BuyerCartWriteConflictException();
          version = Number(updated[0].version);
          await conn`
            DELETE FROM sales.cart_items i
            USING sales.carts c
            WHERE i.cart_id = c.id
              AND c.id = ${cartId}
              AND c.tenant_id = ${params.tenantId}
              AND c.buyer_user_id = ${params.buyerUserId}`;
        }
        if (params.lines.length > 0) {
          await conn`
            INSERT INTO sales.cart_items (
              id, cart_id, product_id, product_name, quantity,
              unit_price_cents, variant_id, sku, subtotal_cents, position
            )
            SELECT u.id, ${cartId}::uuid, u.product_id, u.name, u.quantity,
                   u.price, NULL, u.sku, u.subtotal, u.position
            FROM unnest(
              ${Array.from(params.lines, (): string => randomUUID())}::uuid[],
              ${params.lines.map((line: BuyerCartStoredLine): string => line.productId)}::uuid[],
              ${params.lines.map((line: BuyerCartStoredLine): string => line.name)}::text[],
              ${params.lines.map((line: BuyerCartStoredLine): number => line.quantity)}::int[],
              ${params.lines.map((line: BuyerCartStoredLine): number => line.unitPriceCents)}::int[],
              ${params.lines.map((line: BuyerCartStoredLine): string => line.sku)}::text[],
              ${params.lines.map((line: BuyerCartStoredLine): string =>
                String(line.unitPriceCents * line.quantity),
              )}::bigint[],
              ${Array.from(params.lines.keys())}::int[]
            ) AS u(id, product_id, name, quantity, price, sku, subtotal, position)
            JOIN catalog.products p
              ON p.id = u.product_id AND p.tenant_id = ${params.tenantId}
            WHERE EXISTS (
              SELECT 1 FROM sales.carts c
              WHERE c.id = ${cartId} AND c.tenant_id = ${params.tenantId}
            )`;
        }
        return version;
      });
    } catch (error: unknown) {
      if (error instanceof BuyerCartWriteConflictException) throw error;
      throw new BuyerCartRepositoryException('Failed to save the buyer cart.', error);
    }
  }

  public async touch(
    params: { tenantId: string; buyerUserId: string; cartId: string; now: Date; expiresAt: Date },
    tx: TransactionContext,
  ): Promise<void> {
    try {
      await this.run(tx, async (conn: Connection): Promise<void> => {
        await conn`
          UPDATE sales.carts
          SET expires_at = ${params.expiresAt}, updated_at = ${params.now}
          WHERE id = ${params.cartId}
            AND tenant_id = ${params.tenantId}
            AND buyer_user_id = ${params.buyerUserId}
            AND status = 'active'`;
      });
    } catch (error: unknown) {
      throw new BuyerCartRepositoryException('Failed to extend the buyer cart.', error);
    }
  }

  public async markConverted(
    params: { tenantId: string; buyerUserId: string; now: Date },
    tx: TransactionContext,
  ): Promise<void> {
    try {
      await this.run(tx, async (conn: Connection): Promise<void> => {
        await conn`
          UPDATE sales.carts
          SET status = 'converted', updated_at = ${params.now}, version = version + 1
          WHERE tenant_id = ${params.tenantId}
            AND buyer_user_id = ${params.buyerUserId}
            AND status = 'active'`;
      });
    } catch (error: unknown) {
      throw new BuyerCartRepositoryException('Failed to complete the buyer cart.', error);
    }
  }
}

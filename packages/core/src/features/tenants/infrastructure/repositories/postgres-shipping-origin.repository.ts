import type postgres from 'postgres';
import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import type { ShippingOriginRepositoryPort } from '@/tenants/application/ports/out/shipping-origin-repository.port';
import type {
  ShippingOrigin,
  ShippingOriginProps,
} from '@/tenants/domain/value-objects/shipping-origin.vo';
import { ShippingOriginRepositoryException } from '@/tenants/application/exceptions/shipping-origin-repository.exception';

type TxSql = postgres.TransactionSql<Record<string, unknown>>;

export class PostgresShippingOriginRepository implements ShippingOriginRepositoryPort {
  public constructor(private readonly sql: postgres.Sql<Record<string, unknown>>) {}

  public async canManageStore(
    userId: string,
    tenantId: string,
    tx: TransactionContext,
  ): Promise<boolean> {
    try {
      return await tx.executeNative<TxSql, boolean>(async (sql): Promise<boolean> => {
        const rows = await sql`SELECT 1 FROM core.tenant_memberships m
          WHERE m.tenant_id=${tenantId}::uuid AND m.user_id=${userId}::uuid AND m.status='active'
            AND core.member_has_permission(m.user_id, m.tenant_id, ARRAY['MANAGE_STORE']::text[])
          FOR SHARE OF m`;
        return rows.length > 0;
      });
    } catch (error: unknown) {
      throw new ShippingOriginRepositoryException('Cannot verify store permission.', error);
    }
  }

  public async save(
    tenantId: string,
    origin: ShippingOrigin,
    tx: TransactionContext,
  ): Promise<void> {
    const o = origin.toProps();
    try {
      await tx.executeNative<TxSql, void>(async (sql): Promise<void> => {
        await sql`INSERT INTO core.tenant_shipping_origins
          (tenant_id, contact_name, phone, street, city, state, zip_code, country)
          VALUES (${tenantId}::uuid, ${o.contactName}, ${o.phone}, ${o.street}, ${o.city},
            ${o.state}, ${o.zipCode}, ${o.country})
          ON CONFLICT (tenant_id) DO UPDATE SET contact_name=EXCLUDED.contact_name,
            phone=EXCLUDED.phone, street=EXCLUDED.street, city=EXCLUDED.city,
            state=EXCLUDED.state, zip_code=EXCLUDED.zip_code, country=EXCLUDED.country,
            updated_at=clock_timestamp()`;
      });
    } catch (error: unknown) {
      throw new ShippingOriginRepositoryException('Cannot save shipping origin.', error);
    }
  }

  public async find(tenantId: string): Promise<ShippingOriginProps | null> {
    try {
      const rows = await this.sql<ShippingOriginProps[]>`SELECT contact_name AS "contactName",
        phone, street, city, state, zip_code AS "zipCode", country
        FROM core.tenant_shipping_origins WHERE tenant_id=${tenantId}::uuid`;
      return rows[0] ?? null;
    } catch (error: unknown) {
      throw new ShippingOriginRepositoryException('Cannot read shipping origin.', error);
    }
  }
}

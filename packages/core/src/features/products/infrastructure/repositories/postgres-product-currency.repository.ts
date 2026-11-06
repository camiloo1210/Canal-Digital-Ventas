import type postgres from 'postgres';
import { ProductCurrencyRepositoryPort } from '@/products/application/ports/out/product-currency-repository.port';
import { ProductRepositoryException } from '@/products/application/exceptions/product-repository.exception';
import { Currency, parseCurrency } from '@/shared/domain/enums/currency.enum';
import { TenantId } from '@/shared/domain/types/tenant-id.type';
import { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';

export class PostgresProductCurrencyRepository implements ProductCurrencyRepositoryPort {
  public async getCurrency(tenantId: TenantId, tx: TransactionContext): Promise<Currency> {
    try {
      return await tx.executeNative<postgres.TransactionSql<Record<string, unknown>>, Currency>(
        async (sql): Promise<Currency> => {
          const [row] = await sql<{ currency: Currency }[]>`
            SELECT base_currency AS currency FROM core.tenants WHERE id = ${tenantId}::uuid
          `;
          if (!row) throw new ProductRepositoryException('Product tenant not found.');
          return parseCurrency(row.currency);
        },
      );
    } catch (error: unknown) {
      if (error instanceof ProductRepositoryException) throw error;
      throw new ProductRepositoryException('Failed to resolve product currency.', error);
    }
  }
}

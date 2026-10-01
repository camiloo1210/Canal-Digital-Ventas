import postgres from 'postgres';
import {
  ResolveStoreCustomerInput,
  StoreCustomerRepositoryPort,
} from '@/sales/application/ports/out/store-customer-repository.port';
import { StoreCustomer, StoreCustomerProps } from '@/sales/domain/entities/store-customer.entity';
import { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import { Address } from '@/shared/domain/value-objects/adress.vo';
import { StoreCustomerStatus } from '@/sales/domain/enums/store-customer-status.enum';
import { StoreCustomerRepositoryException } from '@/sales/application/exceptions/store-customer-repository.exception';

export interface DbStoreCustomerRow {
  id: string;
  tenant_id: string;
  global_auth_id: string;
  name: string;
  email: string;
  phone: string;
  document_id: string;
  status: string;
  address_street: string;
  address_city: string;
  address_state: string;
  address_zip_code: string;
  address_country: string;
  address_reference: string | null;
  created_at: Date;
  updated_at: Date;
  version: number;
}

export class PostgresStoreCustomerRepository implements StoreCustomerRepositoryPort {
  async resolveOrCreate(
    input: ResolveStoreCustomerInput,
    tx: TransactionContext,
  ): Promise<StoreCustomer> {
    const row = await tx.executeNative(async (sql: postgres.TransactionSql<Record<string, unknown>>) => {
      const newId = crypto.randomUUID();
      const now = new Date();

      // PostgreSQL atomic UPSERT / DO NOTHING to resolve or create safely
      const inserted = await sql<DbStoreCustomerRow[]>`
        WITH inserted AS (
          INSERT INTO sales.customers (
            id, tenant_id, global_auth_id, name, email, phone, document_id, status,
            address_street, address_city, address_state, address_zip_code, address_country, address_reference,
            created_at, updated_at, version
          ) VALUES (
            ${newId}, ${input.tenantId}, ${input.globalAuthId}, ${input.name}, ${input.email}, ${input.phone}, ${input.documentId}, ${StoreCustomerStatus.ACTIVE},
            ${input.address.getStreet()}, ${input.address.getCity()}, ${input.address.getState()}, ${input.address.getZipCode()}, ${input.address.getCountry()}, ${input.address.getReference() || null},
            ${now}, ${now}, 0
          )
          ON CONFLICT (tenant_id, global_auth_id) DO NOTHING
          RETURNING *
        )
        SELECT * FROM inserted
        UNION ALL
        SELECT * FROM sales.customers
        WHERE tenant_id = ${input.tenantId} AND global_auth_id = ${input.globalAuthId}
        LIMIT 1;
      `;

      return inserted[0];
    });

    if (!row) {
      throw new StoreCustomerRepositoryException('Failed to resolve or create customer due to a concurrent transaction edge case.');
    }

    const address = Address.create(
      row.address_street,
      row.address_city,
      row.address_state,
      row.address_zip_code,
      row.address_country,
      row.address_reference || undefined,
    );

    const props: StoreCustomerProps = {
      id: row.id as unknown as import('@/sales/domain/types/customer-id.type').StoreCustomerId,
      tenantId: row.tenant_id as unknown as import('@/shared/domain/types/tenant-id.type').TenantId,
      globalAuthId: row.global_auth_id as unknown as import('@/sales/domain/types/global-auth-id.type').GlobalAuthId,
      name: row.name,
      email: row.email,
      phone: row.phone,
      documentId: row.document_id,
      address,
      status: row.status as StoreCustomerStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      version: row.version,
    };

    return StoreCustomer.reconstitute(props);
  }
}

import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import type { TenantRoleRepositoryPort } from '@/iam/application/ports/out/tenant-role-repository.port';
import { TenantRole } from '@/iam/domain/entities/tenant-role.entity';
import { TenantRoleNameTakenException } from '@/iam/application/exceptions/tenant-role-name-taken.exception';
import {
  postgresErrorCode,
  runInTx,
  type TxSql,
} from '@/iam/infrastructure/postgres/user-management-sql';

interface RoleRow {
  id: string;
  tenant_id: string;
  name: string;
  permissions: string[];
}

export class PostgresTenantRoleRepository implements TenantRoleRepositoryPort {
  public async findById(
    roleId: string,
    tenantId: string,
    tx: TransactionContext,
  ): Promise<TenantRole | null> {
    return runInTx(
      tx,
      'Unable to load the role',
      async (sql: TxSql): Promise<TenantRole | null> => {
        const rows = await sql<RoleRow[]>`SELECT id, tenant_id, name, permissions
        FROM core.tenant_roles
        WHERE id = ${roleId}::uuid AND tenant_id = ${tenantId}::uuid FOR UPDATE`;
        const row = rows[0];
        return row
          ? TenantRole.reconstitute({
              id: row.id,
              tenantId: row.tenant_id,
              name: row.name,
              permissions: row.permissions,
            })
          : null;
      },
    );
  }

  public async nameExists(
    tenantId: string,
    name: string,
    excludeRoleId: string | null,
    tx: TransactionContext,
  ): Promise<boolean> {
    return runInTx(tx, 'Unable to check the role name', async (sql: TxSql): Promise<boolean> => {
      const rows = await sql`SELECT 1 FROM core.tenant_roles
        WHERE tenant_id = ${tenantId}::uuid AND lower(name) = lower(${name})
          AND (${excludeRoleId}::uuid IS NULL OR id <> ${excludeRoleId}::uuid)`;
      return rows.length > 0;
    });
  }

  public async save(role: TenantRole, tx: TransactionContext): Promise<void> {
    const snapshot = role.toSnapshot();
    try {
      await runInTx(tx, 'Unable to save the role', async (sql: TxSql): Promise<void> => {
        await sql`INSERT INTO core.tenant_roles (id, tenant_id, name, permissions)
          VALUES (${snapshot.id}::uuid, ${snapshot.tenantId}::uuid, ${snapshot.name},
                  string_to_array(${snapshot.permissions.join(',')}, ','))
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name, permissions = EXCLUDED.permissions, updated_at = now()
          WHERE core.tenant_roles.tenant_id = EXCLUDED.tenant_id`;
      });
    } catch (error: unknown) {
      const cause =
        typeof error === 'object' && error !== null && 'originalError' in error
          ? (error as { originalError: unknown }).originalError
          : error;
      if (postgresErrorCode(cause) === '23505') throw new TenantRoleNameTakenException();
      throw error;
    }
  }

  public async delete(roleId: string, tenantId: string, tx: TransactionContext): Promise<void> {
    await runInTx(tx, 'Unable to delete the role', async (sql: TxSql): Promise<void> => {
      await sql`DELETE FROM core.tenant_roles
        WHERE id = ${roleId}::uuid AND tenant_id = ${tenantId}::uuid`;
    });
  }

  public async countMembers(
    roleId: string,
    tenantId: string,
    tx: TransactionContext,
  ): Promise<number> {
    return runInTx(tx, 'Unable to count role members', async (sql: TxSql): Promise<number> => {
      const rows = await sql<Array<{ total: number }>>`SELECT count(*)::int AS total
        FROM core.tenant_memberships
        WHERE custom_role_id = ${roleId}::uuid AND tenant_id = ${tenantId}::uuid`;
      return rows[0]?.total ?? 0;
    });
  }
}

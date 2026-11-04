import type postgres from 'postgres';
import type { TenantRoleReadPort } from '@/iam/application/ports/out/tenant-role-read.port';
import type { InvitationReadPort } from '@/iam/application/ports/out/invitation-read.port';
import type { MemberDirectoryReadPort } from '@/iam/application/ports/out/member-directory-read.port';
import type { DemographicStatsReadPort } from '@/iam/application/ports/out/demographic-stats-read.port';
import type { InvitationPreviewReadPort } from '@/iam/application/ports/out/invitation-preview-read.port';
import type { OwnProfileReadPort } from '@/iam/application/ports/out/own-profile-read.port';
import type { MemberPermissionsReadPort } from '@/iam/application/ports/out/member-permissions-read.port';
import type {
  DemographicBucketCount,
  DemographicStatsReadModel,
  InvitationPreviewReadModel,
  InvitationReadModel,
  InvitationViewStatus,
  MemberPermissionsReadModel,
  MemberReadModel,
  OwnProfileReadModel,
  TenantRoleReadModel,
} from '@/iam/application/read-models/user-management.read-models';
import { parseInvitationAccountMode } from '@/iam/domain/value-objects/invitation-account-mode.vo';
import { suppressSmallBuckets } from '@/iam/application/demographic-k-anonymity';
import { resolveEffectivePermissions } from '@/iam/domain/effective-permissions';
import { UserManagementRepositoryException } from '@/iam/application/exceptions/user-management-repository.exception';

type Sql = postgres.Sql<Record<string, unknown>>;

async function guarded<T>(message: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error: unknown) {
    throw new UserManagementRepositoryException(message, error);
  }
}

/** The ownership check is part of every owner-only query below. */
const OWNER_GUARD = (
  sql: Sql,
  userId: string,
  tenantId: string,
): postgres.PendingQuery<postgres.Row[]> =>
  sql`EXISTS (SELECT 1 FROM core.tenant_memberships om
    WHERE om.tenant_id = ${tenantId}::uuid AND om.user_id = ${userId}::uuid
      AND om.status = 'active' AND om.role = 'OWNER')`;

export class PostgresTenantRoleReadRepository implements TenantRoleReadPort {
  public constructor(private readonly sql: Sql) {}

  public async listForOwner(userId: string, tenantId: string): Promise<TenantRoleReadModel[]> {
    return guarded('Unable to list roles', async (): Promise<TenantRoleReadModel[]> => {
      const rows = await this.sql<
        Array<{
          id: string;
          name: string;
          permissions: string[];
          member_count: number;
          is_system: boolean;
          created_at: Date;
        }>
      >`SELECT r.id, r.name, r.permissions, r.created_at, r.is_system,
          (SELECT count(*)::int FROM core.tenant_memberships m
            WHERE m.custom_role_id = r.id) AS member_count
        FROM core.tenant_roles r
        WHERE r.tenant_id = ${tenantId}::uuid AND ${OWNER_GUARD(this.sql, userId, tenantId)}
        ORDER BY lower(r.name)`;
      return rows.map((row): TenantRoleReadModel => ({
        id: row.id,
        name: row.name,
        permissions: row.permissions,
        memberCount: row.member_count,
        isSystem: row.is_system,
        createdAt: row.created_at.toISOString(),
      }));
    });
  }
}

export class PostgresInvitationReadRepository implements InvitationReadPort {
  public constructor(private readonly sql: Sql) {}

  public async listForOwner(userId: string, tenantId: string): Promise<InvitationReadModel[]> {
    return guarded('Unable to list invitations', async (): Promise<InvitationReadModel[]> => {
      const rows = await this.sql<
        Array<{
          id: string;
          role_id: string;
          role_name: string;
          expires_at: Date;
          max_uses: number;
          use_count: number;
          revoked_at: Date | null;
          created_at: Date;
          status: InvitationViewStatus;
          account_mode: string;
        }>
      >`SELECT i.id, i.role_id, r.name AS role_name, i.expires_at, i.max_uses, i.use_count,
          i.revoked_at, i.created_at, i.account_mode,
          CASE WHEN i.revoked_at IS NOT NULL THEN 'REVOKED'
               WHEN i.expires_at <= now() THEN 'EXPIRED'
               WHEN i.use_count >= i.max_uses THEN 'EXHAUSTED'
               ELSE 'ACTIVE' END AS status
        FROM core.tenant_invitations i
        JOIN core.tenant_roles r ON r.id = i.role_id
        WHERE i.tenant_id = ${tenantId}::uuid AND ${OWNER_GUARD(this.sql, userId, tenantId)}
        ORDER BY i.created_at DESC
        LIMIT 200`;
      return rows.map((row): InvitationReadModel => ({
        id: row.id,
        roleId: row.role_id,
        roleName: row.role_name,
        expiresAt: row.expires_at.toISOString(),
        maxUses: row.max_uses,
        useCount: row.use_count,
        revokedAt: row.revoked_at ? row.revoked_at.toISOString() : null,
        status: row.status,
        accountMode: parseInvitationAccountMode(row.account_mode),
        createdAt: row.created_at.toISOString(),
      }));
    });
  }
}

const ACCESS_STATUS: Record<MemberReadModel['status'], MemberReadModel['accessStatus']> = {
  active: 'ACTIVE',
  suspended: 'SUSPENDED',
  invited: 'PENDING',
};

export class PostgresMemberDirectoryReadRepository implements MemberDirectoryReadPort {
  public constructor(private readonly sql: Sql) {}

  public async listForOwner(userId: string, tenantId: string): Promise<MemberReadModel[]> {
    return guarded('Unable to list members', async (): Promise<MemberReadModel[]> => {
      const rows = await this.sql<
        Array<{
          user_id: string;
          first_name: string | null;
          last_name: string | null;
          email: string;
          base_role: MemberReadModel['baseRole'];
          role_id: string | null;
          role_name: string | null;
          status: MemberReadModel['status'];
          managed_by_tenant_id: string | null;
        }>
      >`SELECT m.user_id, u.first_name, u.last_name, u.email, m.role AS base_role,
          m.custom_role_id AS role_id, r.name AS role_name, m.status,
          u.managed_by_tenant_id
        FROM core.tenant_memberships m
        JOIN core.users u ON u.id = m.user_id
        LEFT JOIN core.tenant_roles r ON r.id = m.custom_role_id
        WHERE m.tenant_id = ${tenantId}::uuid AND ${OWNER_GUARD(this.sql, userId, tenantId)}
        ORDER BY (m.role = 'OWNER') DESC, lower(u.email)`;
      return rows.map((row): MemberReadModel => ({
        userId: row.user_id,
        firstName: row.first_name ?? '',
        lastName: row.last_name ?? '',
        email: row.email,
        baseRole: row.base_role,
        roleId: row.role_id,
        roleName: row.role_name,
        status: row.status,
        accountKind: row.managed_by_tenant_id === tenantId ? 'MANAGED' : 'PERSONAL',
        accessStatus: ACCESS_STATUS[row.status],
      }));
    });
  }
}

export class PostgresDemographicStatsReadRepository implements DemographicStatsReadPort {
  public constructor(private readonly sql: Sql) {}

  public async findForOwner(userId: string, tenantId: string): Promise<DemographicStatsReadModel> {
    return guarded(
      'Unable to read demographic stats',
      async (): Promise<DemographicStatsReadModel> => {
        const rows = await this.sql<Array<{ dimension: string; value: string; total: number }>>`
        SELECT d.dimension, d.value, count(*)::int AS total
        FROM analytics.demographic_samples s
        CROSS JOIN LATERAL (VALUES
          ('ageRange', s.age_range), ('gender', s.gender), ('province', s.province)
        ) AS d(dimension, value)
        WHERE s.tenant_id = ${tenantId}::uuid AND d.value IS NOT NULL
          AND ${OWNER_GUARD(this.sql, userId, tenantId)}
        GROUP BY d.dimension, d.value
        ORDER BY total DESC, d.value`;
        const totals = await this.sql<Array<{ total: number }>>`
        SELECT count(*)::int AS total
        FROM analytics.demographic_samples s
        WHERE s.tenant_id = ${tenantId}::uuid AND ${OWNER_GUARD(this.sql, userId, tenantId)}`;
        const totalSamples = totals[0]?.total ?? 0;
        const pick = (dimension: string): DemographicBucketCount[] =>
          rows
            .filter((row): boolean => row.dimension === dimension)
            .map((row): DemographicBucketCount => ({ value: row.value, count: row.total }));
        return {
          ageRange: suppressSmallBuckets(pick('ageRange'), totalSamples),
          gender: suppressSmallBuckets(pick('gender'), totalSamples),
          province: suppressSmallBuckets(pick('province'), totalSamples),
        };
      },
    );
  }
}

export class PostgresInvitationPreviewReadRepository implements InvitationPreviewReadPort {
  public constructor(private readonly sql: Sql) {}

  public async findUsableByTokenHash(
    tokenHash: string,
  ): Promise<InvitationPreviewReadModel | null> {
    return guarded(
      'Unable to read the invitation',
      async (): Promise<InvitationPreviewReadModel | null> => {
        const rows = await this.sql<
          Array<{
            tenant_id: string;
            tenant_name: string;
            tenant_slug: string;
            role_name: string;
            account_mode: string;
          }>
        >`
        SELECT t.id AS tenant_id, t.name AS tenant_name, t.slug AS tenant_slug, r.name AS role_name, i.account_mode
        FROM core.tenant_invitations i
        JOIN core.tenants t ON t.id = i.tenant_id
        JOIN core.tenant_roles r ON r.id = i.role_id
        WHERE i.token_hash = ${tokenHash} AND i.revoked_at IS NULL
          AND i.expires_at > now() AND i.use_count < i.max_uses`;
        const row = rows[0];
        return row
          ? {
              tenantId: row.tenant_id,
              tenantName: row.tenant_name,
              tenantSlug: row.tenant_slug,
              roleName: row.role_name,
              accountMode: parseInvitationAccountMode(row.account_mode),
            }
          : null;
      },
    );
  }
}

export class PostgresMemberPermissionsReadRepository implements MemberPermissionsReadPort {
  public constructor(private readonly sql: Sql) {}

  public async findForUser(
    userId: string,
    tenantId: string,
  ): Promise<MemberPermissionsReadModel | null> {
    return guarded(
      'Unable to read member permissions',
      async (): Promise<MemberPermissionsReadModel | null> => {
        const rows = await this.sql<
          Array<{
            base_role: MemberPermissionsReadModel['baseRole'];
            role_name: string | null;
            permissions: string[] | null;
          }>
        >`SELECT m.role AS base_role, r.name AS role_name, r.permissions
        FROM core.tenant_memberships m
        LEFT JOIN core.tenant_roles r ON r.id = m.custom_role_id
        WHERE m.tenant_id = ${tenantId}::uuid AND m.user_id = ${userId}::uuid
          AND m.status = 'active'`;
        const row = rows[0];
        if (!row) return null;
        return {
          baseRole: row.base_role,
          roleName: row.role_name,
          permissions: resolveEffectivePermissions(row.base_role, row.permissions ?? []),
        };
      },
    );
  }
}

export class PostgresOwnProfileReadRepository implements OwnProfileReadPort {
  public constructor(private readonly sql: Sql) {}

  public async findForUser(userId: string): Promise<OwnProfileReadModel | null> {
    return guarded('Unable to read the profile', async (): Promise<OwnProfileReadModel | null> => {
      const rows = await this.sql<
        Array<{
          first_name: string | null;
          last_name: string | null;
          email: string;
          demographic_consent: boolean;
        }>
      >`SELECT first_name, last_name, email, demographic_consent
        FROM core.users WHERE id = ${userId}::uuid`;
      const row = rows[0];
      if (!row) return null;
      return {
        firstName: row.first_name ?? '',
        lastName: row.last_name ?? '',
        email: row.email,
        demographicConsent: row.demographic_consent,
      };
    });
  }
}

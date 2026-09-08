import { User } from '@/iam/domain/entities/user.entity';
import { DbUserRow } from '@/iam/infrastructure/types/supabase-user.types';
import { UserId } from '@/iam/domain/types/user-id.type';
import { TenantId } from '@/shared/domain/types/tenant-id.type';
import { Email } from '@/shared/domain/value-objects/email.vo';
import { PersonName } from '@/shared/domain/value-objects/person-name.vo';
import { UserRole } from '@/iam/domain/enums/role.enum';
import { UserStatus } from '@/iam/domain/enums/status.enum';
import { UserPermission } from '@/iam/domain/enums/permission.enum';

export class SupabaseUserMapper {
  static toDomain(row: DbUserRow): User {
    const firstName = row.first_name ? PersonName.create(row.first_name) : null;
    const lastName = row.last_name ? PersonName.create(row.last_name) : null;

    return User.reconstitute({
      id: row.id as UserId,
      tenantId: row.tenant_id as TenantId,
      email: Email.create(row.email),
      role: row.role as UserRole,
      status: row.status as UserStatus,
      firstName,
      lastName,
      permissions: (row.permissions || []) as UserPermission[],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      version: row.version ?? 0,
    });
  }

  static toPersistence(user: User): DbUserRow {
    return {
      id: user.getId(),
      tenant_id: user.getTenantId(),
      email: user.getEmail().getValue(),
      first_name: user.getFirstName()?.getValue() || '',
      last_name: user.getLastName()?.getValue() || '',
      role: user.getRole(),
      permissions: user.getPermissions(),
      status: user.getStatus(),
      created_at: user.getCreatedAt().toISOString(),
      updated_at: user.getUpdatedAt().toISOString(),
      version: user.getVersion(),
    };
  }
}

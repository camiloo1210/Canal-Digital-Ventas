import { TenantRoleName } from '@/iam/domain/value-objects/tenant-role-name.vo';
import { UserPermission } from '@/iam/domain/enums/permission.enum';
import { InvalidTenantRoleException } from '@/iam/domain/exceptions/invalid-tenant-role.exception';

export interface TenantRoleSnapshot {
  id: string;
  tenantId: string;
  name: string;
  permissions: UserPermission[];
  isSystem: boolean;
}

interface TenantRoleProps {
  id: string;
  tenantId: string;
  name: string;
  permissions: readonly string[];
  /** Default role every store starts with: editable, never deletable. */
  isSystem?: boolean;
}

const KNOWN_PERMISSIONS: readonly string[] = Object.values(UserPermission);

function isPermission(value: string): value is UserPermission {
  return KNOWN_PERMISSIONS.includes(value);
}

export class TenantRole {
  private constructor(
    private readonly id: string,
    private readonly tenantId: string,
    private name: TenantRoleName,
    private permissions: ReadonlySet<UserPermission>,
    private readonly system: boolean,
  ) {}

  public static create(props: TenantRoleProps): TenantRole {
    if (!props.id) throw new InvalidTenantRoleException('Role id is required');
    if (!props.tenantId) throw new InvalidTenantRoleException('Tenant id is required');
    return new TenantRole(
      props.id,
      props.tenantId,
      TenantRoleName.create(props.name),
      TenantRole.parsePermissions(props.permissions),
      props.isSystem ?? false,
    );
  }

  /** Rebuilds a persisted role; unknown legacy permission strings are dropped. */
  public static reconstitute(props: TenantRoleProps): TenantRole {
    return new TenantRole(
      props.id,
      props.tenantId,
      TenantRoleName.reconstitute(props.name),
      new Set(props.permissions.filter(isPermission)),
      props.isSystem ?? false,
    );
  }

  private static parsePermissions(raw: readonly string[]): ReadonlySet<UserPermission> {
    const result = new Set<UserPermission>();
    for (const permission of raw) {
      if (!isPermission(permission)) {
        throw new InvalidTenantRoleException(`Unknown permission: ${permission}`);
      }
      result.add(permission);
    }
    if (result.size === 0) {
      throw new InvalidTenantRoleException('A role needs at least one permission');
    }
    return result;
  }

  public rename(name: string): void {
    this.name = TenantRoleName.create(name);
  }

  public setPermissions(permissions: readonly string[]): void {
    this.permissions = TenantRole.parsePermissions(permissions);
  }

  public hasPermission(permission: UserPermission): boolean {
    return this.permissions.has(permission);
  }

  public isSystem(): boolean {
    return this.system;
  }

  public getId(): string {
    return this.id;
  }

  public getTenantId(): string {
    return this.tenantId;
  }

  public getName(): string {
    return this.name.getValue();
  }

  public getPermissions(): UserPermission[] {
    return [...this.permissions];
  }

  public toSnapshot(): TenantRoleSnapshot {
    return {
      id: this.id,
      tenantId: this.tenantId,
      name: this.getName(),
      permissions: this.getPermissions(),
      isSystem: this.system,
    };
  }
}

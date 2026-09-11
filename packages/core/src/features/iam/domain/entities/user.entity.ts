import { UserId } from '@/iam/domain/types/user-id.type';
import { TenantId } from '@/shared/domain/types/tenant-id.type';
import { Email } from '@/shared/domain/value-objects/email.vo';
import { PersonName } from '@/shared/domain/value-objects/person-name.vo';
import { UserRole } from '@/iam/domain/enums/role.enum';
import { UserStatus } from '@/iam/domain/enums/status.enum';
import { UserPermission } from '@/iam/domain/enums/permission.enum';
import { InvalidUserStateException } from '@/iam/domain/exceptions/invalid-user-state.exception';
import { InvalidUserAttributeException } from '@/iam/domain/exceptions/invalid-user-attribute.exception';
import { InvalidRoleOperationException } from '@/iam/domain/exceptions/invalid-role-operation.exception';
import { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import { UserInvitedEvent } from '@/iam/domain/events/user-invited.event';
import { UserRoleChangedEvent } from '@/iam/domain/events/user-role-changed.event';
import { UserSuspendedEvent } from '@/iam/domain/events/user-suspended.event';
import { UserPermissionsUpdatedEvent } from '@/iam/domain/events/user-permissions-updated.event';
import { UserProfileUpdatedEvent } from '@/iam/domain/events/user-profile-updated.event';

export interface UserProps {
  id: UserId;
  tenantId: TenantId;
  email: Email;
  role: UserRole;
  status: UserStatus;
  firstName: PersonName | null;
  lastName: PersonName | null;
  permissions: UserPermission[];
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export class User {
  private readonly _domainEvents: DomainEvent[] = [];

  private constructor(
    private readonly id: UserId,
    private readonly tenantId: TenantId,
    private readonly email: Email,
    private role: UserRole,
    private status: UserStatus,
    private firstName: PersonName | null,
    private lastName: PersonName | null,
    private permissions: UserPermission[],
    private readonly createdAt: Date,
    private updatedAt: Date,
    private version: number,
  ) {}

  public static invite(id: UserId, tenantId: TenantId, email: Email, role: UserRole): User {
    User.validateId(id);
    User.validateTenantId(tenantId);
    User.validateEmail(email);
    User.validateRole(role);

    const user = new User(
      id,
      tenantId,
      email,
      role,
      UserStatus.INVITED,
      null,
      null,
      [],
      new Date(),
      new Date(),
      0,
    );

    user.addDomainEvent(new UserInvitedEvent(id, tenantId, email, role));
    return user;
  }

  // Validations
  private static validateId(id: UserId): void {
    if (!id || id.trim().length === 0) {
      throw new InvalidUserAttributeException('User ID is required.');
    }
  }

  private static validateTenantId(tenantId: TenantId): void {
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim().length === 0) {
      throw new InvalidUserAttributeException('Tenant ID is required and must be a valid string.');
    }
  }

  private static validateEmail(email: Email): void {
    if (!email) {
      throw new InvalidUserAttributeException('Email is required.');
    }
  }

  private static validateRole(role: UserRole): void {
    if (!role || !Object.values(UserRole).includes(role)) {
      throw new InvalidUserAttributeException('Invalid user role.');
    }
  }

  // Actions / Updates
  public changeRole(newRole: UserRole): void {
    if (this.role === UserRole.OWNER && newRole !== UserRole.OWNER) {
      throw new InvalidUserStateException('Cannot change the role of an OWNER directly.');
    }
    User.validateRole(newRole);

    const oldRole = this.role;
    this.role = newRole;

    this.addDomainEvent(new UserRoleChangedEvent(this.id, oldRole, newRole));
    this.updateUpdatedAt();
  }

  public suspend(): void {
    if (this.role === UserRole.OWNER) {
      throw new InvalidUserStateException('Cannot suspend an OWNER.');
    }
    if (this.status === UserStatus.SUSPENDED) {
      throw new InvalidUserStateException('User is already suspended.');
    }

    this.status = UserStatus.SUSPENDED;
    this.addDomainEvent(new UserSuspendedEvent(this.id));
    this.updateUpdatedAt();
  }

  public updateProfile(firstName: PersonName, lastName: PersonName): void {
    this.firstName = firstName;
    this.lastName = lastName;

    this.addDomainEvent(
      new UserProfileUpdatedEvent(
        this.id,
        this.tenantId,
        firstName.getValue(),
        lastName.getValue(),
      ),
    );
    this.updateUpdatedAt();
  }

  // Permissions Management
  public hasPermission(permission: UserPermission): boolean {
    if (this.role === UserRole.OWNER) return true;
    return this.permissions.includes(permission);
  }

  public grantPermissions(newPermissions: UserPermission[]): void {
    if (this.role === UserRole.OWNER) {
      throw new InvalidRoleOperationException('Cannot assign discrete permissions to an OWNER.');
    }

    let changed = false;
    for (const perm of newPermissions) {
      if (!this.permissions.includes(perm)) {
        this.permissions.push(perm);
        changed = true;
      }
    }

    if (changed) {
      this.addDomainEvent(
        new UserPermissionsUpdatedEvent(this.id, this.tenantId, [...this.permissions]),
      );
      this.updateUpdatedAt();
    }
  }

  public revokePermissions(permissionsToRevoke: UserPermission[]): void {
    if (this.role === UserRole.OWNER) {
      throw new InvalidRoleOperationException('Cannot revoke permissions from an OWNER.');
    }

    let changed = false;
    for (const perm of permissionsToRevoke) {
      const index = this.permissions.indexOf(perm);
      if (index !== -1) {
        this.permissions.splice(index, 1);
        changed = true;
      }
    }

    if (changed) {
      this.addDomainEvent(
        new UserPermissionsUpdatedEvent(this.id, this.tenantId, [...this.permissions]),
      );
      this.updateUpdatedAt();
    }
  }

  private updateUpdatedAt(): void {
    this.updatedAt = new Date();
    this.version++;
  }

  // Domain Events Management
  private addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  public get domainEvents(): DomainEvent[] {
    return [...this._domainEvents];
  }

  public clearDomainEvents(): void {
    this._domainEvents.length = 0;
  }

  // Reconstitute
  public static reconstitute(props: UserProps): User {
    return new User(
      props.id,
      props.tenantId,
      props.email,
      props.role,
      props.status,
      props.firstName,
      props.lastName,
      [...props.permissions],
      props.createdAt,
      props.updatedAt,
      props.version,
    );
  }

  // Getters
  public getId(): UserId {
    return this.id;
  }

  public getTenantId(): TenantId {
    return this.tenantId;
  }

  public getEmail(): Email {
    return this.email;
  }

  public getRole(): UserRole {
    return this.role;
  }

  public getStatus(): UserStatus {
    return this.status;
  }

  public getFirstName(): PersonName | null {
    return this.firstName;
  }

  public getLastName(): PersonName | null {
    return this.lastName;
  }

  public getPermissions(): UserPermission[] {
    return [...this.permissions];
  }

  public getCreatedAt(): Date {
    return this.createdAt;
  }

  public getUpdatedAt(): Date {
    return this.updatedAt;
  }

  public getVersion(): number {
    return this.version;
  }
}

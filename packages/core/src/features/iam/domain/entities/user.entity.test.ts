import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { User } from '@/iam/domain/entities/user.entity';
import { UserRole } from '@/iam/domain/enums/role.enum';
import { UserStatus } from '@/iam/domain/enums/status.enum';
import { UserPermission } from '@/iam/domain/enums/permission.enum';
import { InvalidUserStateException } from '@/iam/domain/exceptions/invalid-user-state.exception';
import { InvalidRoleOperationException } from '@/iam/domain/exceptions/invalid-role-operation.exception';
import { InvalidUserAttributeException } from '@/iam/domain/exceptions/invalid-user-attribute.exception';
import { createUserId } from '@/iam/domain/types/user-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { Email } from '@/shared/domain/value-objects/email.vo';
import { PersonName } from '@/shared/domain/value-objects/person-name.vo';

const USER_ID = createUserId('11111111-1111-4111-8111-111111111111');
const TENANT_ID = createTenantId('22222222-2222-4222-8222-222222222222');
const T0 = new Date('2026-01-01T00:00:00.000Z');
const T1 = new Date('2026-01-02T00:00:00.000Z');

function makeOwner(): User {
  return User.createOwner(
    USER_ID,
    TENANT_ID,
    Email.create('owner@example.com'),
    PersonName.create('Ana'),
    PersonName.create('Gomez'),
  );
}

function makeInvited(role: UserRole = UserRole.EMPLOYEE): User {
  const user = User.invite(USER_ID, TENANT_ID, Email.create('staff@example.com'), role);
  user.clearDomainEvents();
  return user;
}

describe('User', (): void => {
  beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });

  afterEach((): void => {
    vi.useRealTimers();
  });

  describe('factories', (): void => {
    it('createOwner creates an active owner with no discrete permissions', (): void => {
      const user = makeOwner();
      expect(user.getRole()).toBe(UserRole.OWNER);
      expect(user.getStatus()).toBe(UserStatus.ACTIVE);
      expect(user.getPermissions()).toEqual([]);
      expect(user.getVersion()).toBe(0);
      expect(user.getCreatedAt()).toEqual(T0);
      expect(user.domainEvents.map((e): string => e.eventName)).toEqual(['UserRegisteredEvent']);
    });

    it('invite creates an INVITED user without profile and emits UserInvitedEvent', (): void => {
      const user = User.invite(
        USER_ID,
        TENANT_ID,
        Email.create('staff@example.com'),
        UserRole.ADMIN,
      );
      expect(user.getStatus()).toBe(UserStatus.INVITED);
      expect(user.getRole()).toBe(UserRole.ADMIN);
      expect(user.getFirstName()).toBeNull();
      expect(user.getLastName()).toBeNull();
      expect(user.domainEvents.map((e): string => e.eventName)).toEqual(['UserInvitedEvent']);
    });

    it('invite rejects an unknown role', (): void => {
      expect((): unknown =>
        User.invite(USER_ID, TENANT_ID, Email.create('a@example.com'), 'ROOT' as UserRole),
      ).toThrow(new InvalidUserAttributeException('Invalid user role.'));
    });
  });

  describe('owner protections', (): void => {
    it('changeRole away from OWNER throws', (): void => {
      const owner = makeOwner();
      expect((): unknown => owner.changeRole(UserRole.ADMIN)).toThrow(InvalidUserStateException);
      expect((): unknown => owner.changeRole(UserRole.ADMIN)).toThrow(
        'Cannot change the role of an OWNER directly.',
      );
      expect(owner.getRole()).toBe(UserRole.OWNER);
    });

    it('suspend throws for an owner', (): void => {
      const owner = makeOwner();
      expect((): unknown => owner.suspend()).toThrow(InvalidUserStateException);
      expect((): unknown => owner.suspend()).toThrow('Cannot suspend an OWNER.');
      expect(owner.getStatus()).toBe(UserStatus.ACTIVE);
    });

    it('grantPermissions and revokePermissions throw InvalidRoleOperationException', (): void => {
      const owner = makeOwner();
      expect((): unknown => owner.grantPermissions([UserPermission.VIEW_ORDERS])).toThrow(
        InvalidRoleOperationException,
      );
      expect((): unknown => owner.grantPermissions([UserPermission.VIEW_ORDERS])).toThrow(
        'Cannot assign discrete permissions to an OWNER.',
      );
      expect((): unknown => owner.revokePermissions([UserPermission.VIEW_ORDERS])).toThrow(
        InvalidRoleOperationException,
      );
      expect((): unknown => owner.revokePermissions([UserPermission.VIEW_ORDERS])).toThrow(
        'Cannot revoke permissions from an OWNER.',
      );
    });

    it('hasPermission is true for every permission', (): void => {
      const owner = makeOwner();
      for (const permission of Object.values(UserPermission)) {
        expect(owner.hasPermission(permission)).toBe(true);
      }
    });
  });

  describe('changeRole', (): void => {
    it('changes a non-owner role, emits event with both roles and bumps version/updatedAt', (): void => {
      const user = makeInvited(UserRole.EMPLOYEE);
      vi.setSystemTime(T1);
      user.changeRole(UserRole.ADMIN);

      expect(user.getRole()).toBe(UserRole.ADMIN);
      expect(user.getVersion()).toBe(1);
      expect(user.getUpdatedAt()).toEqual(T1);
      expect(user.domainEvents).toHaveLength(1);
      expect(user.domainEvents[0]).toMatchObject({
        eventName: 'UserRoleChangedEvent',
        userId: USER_ID,
        oldRole: UserRole.EMPLOYEE,
        newRole: UserRole.ADMIN,
      });
    });

    it('rejects an unknown role for a non-owner', (): void => {
      const user = makeInvited();
      expect((): unknown => user.changeRole('ROOT' as UserRole)).toThrow(
        InvalidUserAttributeException,
      );
      expect(user.getRole()).toBe(UserRole.EMPLOYEE);
      expect(user.domainEvents).toHaveLength(0);
    });

    it('allows an owner to be set to OWNER again', (): void => {
      const owner = makeOwner();
      expect((): unknown => owner.changeRole(UserRole.OWNER)).not.toThrow();
      expect(owner.getRole()).toBe(UserRole.OWNER);
    });
  });

  describe('suspend', (): void => {
    it('suspends a non-owner and emits UserSuspendedEvent', (): void => {
      const user = makeInvited();
      vi.setSystemTime(T1);
      user.suspend();
      expect(user.getStatus()).toBe(UserStatus.SUSPENDED);
      expect(user.getVersion()).toBe(1);
      expect(user.getUpdatedAt()).toEqual(T1);
      expect(user.domainEvents.map((e): string => e.eventName)).toEqual(['UserSuspendedEvent']);
    });

    it('throws when suspended twice', (): void => {
      const user = makeInvited();
      user.suspend();
      expect((): unknown => user.suspend()).toThrow(InvalidUserStateException);
      expect((): unknown => user.suspend()).toThrow('User is already suspended.');
      expect(user.getVersion()).toBe(1);
    });
  });

  describe('updateProfile', (): void => {
    it('sets the names, emits an event and bumps version', (): void => {
      const user = makeInvited();
      vi.setSystemTime(T1);
      user.updateProfile(PersonName.create('Luis'), PersonName.create('Perez'));
      expect(user.getFirstName()?.getValue()).toBe('Luis');
      expect(user.getLastName()?.getValue()).toBe('Perez');
      expect(user.getVersion()).toBe(1);
      expect(user.getUpdatedAt()).toEqual(T1);
      expect(user.domainEvents[0]).toMatchObject({
        eventName: 'UserProfileUpdatedEvent',
        userId: USER_ID,
        tenantId: TENANT_ID,
      });
    });
  });

  describe('permissions', (): void => {
    it('hasPermission reflects granted permissions for non-owners', (): void => {
      const user = makeInvited();
      expect(user.hasPermission(UserPermission.VIEW_ORDERS)).toBe(false);
      user.grantPermissions([UserPermission.VIEW_ORDERS]);
      expect(user.hasPermission(UserPermission.VIEW_ORDERS)).toBe(true);
      expect(user.hasPermission(UserPermission.MANAGE_USERS)).toBe(false);
    });

    it('grantPermissions is idempotent: no event and no updatedAt/version change', (): void => {
      const user = makeInvited();
      user.grantPermissions([UserPermission.VIEW_ORDERS]);
      user.clearDomainEvents();
      const updatedAt = user.getUpdatedAt();
      const version = user.getVersion();

      vi.setSystemTime(T1);
      user.grantPermissions([UserPermission.VIEW_ORDERS]);

      expect(user.domainEvents).toHaveLength(0);
      expect(user.getUpdatedAt()).toEqual(updatedAt);
      expect(user.getVersion()).toBe(version);
      expect(user.getPermissions()).toEqual([UserPermission.VIEW_ORDERS]);
    });

    it('grantPermissions with a mix emits one event with the full list', (): void => {
      const user = makeInvited();
      user.grantPermissions([UserPermission.VIEW_ORDERS]);
      user.clearDomainEvents();

      vi.setSystemTime(T1);
      user.grantPermissions([UserPermission.VIEW_ORDERS, UserPermission.VIEW_CATALOG]);

      expect(user.domainEvents).toHaveLength(1);
      expect(user.domainEvents[0]).toMatchObject({
        eventName: 'UserPermissionsUpdatedEvent',
        userId: USER_ID,
        tenantId: TENANT_ID,
        permissions: [UserPermission.VIEW_ORDERS, UserPermission.VIEW_CATALOG],
      });
      expect(user.getUpdatedAt()).toEqual(T1);
      expect(user.getVersion()).toBe(2);
    });

    it('grantPermissions with duplicates in the same call adds them once', (): void => {
      const user = makeInvited();
      user.grantPermissions([UserPermission.VIEW_ORDERS, UserPermission.VIEW_ORDERS]);
      expect(user.getPermissions()).toEqual([UserPermission.VIEW_ORDERS]);
    });

    it('revokePermissions removes held permissions and emits one event with the remainder', (): void => {
      const user = makeInvited();
      user.grantPermissions([UserPermission.VIEW_ORDERS, UserPermission.VIEW_CATALOG]);
      user.clearDomainEvents();

      vi.setSystemTime(T1);
      user.revokePermissions([UserPermission.VIEW_ORDERS, UserPermission.MANAGE_USERS]);

      expect(user.getPermissions()).toEqual([UserPermission.VIEW_CATALOG]);
      expect(user.domainEvents).toHaveLength(1);
      expect(user.domainEvents[0]).toMatchObject({
        eventName: 'UserPermissionsUpdatedEvent',
        permissions: [UserPermission.VIEW_CATALOG],
      });
      expect(user.getUpdatedAt()).toEqual(T1);
    });

    it('revokePermissions ignoring only unheld permissions emits no event and no change', (): void => {
      const user = makeInvited();
      user.grantPermissions([UserPermission.VIEW_ORDERS]);
      user.clearDomainEvents();
      const updatedAt = user.getUpdatedAt();
      const version = user.getVersion();

      vi.setSystemTime(T1);
      user.revokePermissions([UserPermission.MANAGE_USERS]);

      expect(user.domainEvents).toHaveLength(0);
      expect(user.getUpdatedAt()).toEqual(updatedAt);
      expect(user.getVersion()).toBe(version);
      expect(user.getPermissions()).toEqual([UserPermission.VIEW_ORDERS]);
    });

    it('getPermissions returns a copy', (): void => {
      const user = makeInvited();
      user.grantPermissions([UserPermission.VIEW_ORDERS]);
      const copy = user.getPermissions();
      copy.push(UserPermission.MANAGE_USERS);
      copy.length = 0;
      expect(user.getPermissions()).toEqual([UserPermission.VIEW_ORDERS]);
      expect(user.hasPermission(UserPermission.MANAGE_USERS)).toBe(false);
    });

    it('emitted event permissions are a snapshot, not the live array', (): void => {
      const user = makeInvited();
      user.grantPermissions([UserPermission.VIEW_ORDERS]);
      user.grantPermissions([UserPermission.VIEW_CATALOG]);
      const first = user.domainEvents[0] as unknown as { permissions: string[] };
      expect(first.permissions).toEqual([UserPermission.VIEW_ORDERS]);
    });
  });

  describe('reconstitute', (): void => {
    it('copies the permissions array and keeps props', (): void => {
      const permissions = [UserPermission.VIEW_ORDERS];
      const user = User.reconstitute({
        id: USER_ID,
        tenantId: TENANT_ID,
        email: Email.reconstitute('a@example.com'),
        role: UserRole.EMPLOYEE,
        status: UserStatus.ACTIVE,
        firstName: null,
        lastName: null,
        permissions,
        createdAt: T0,
        updatedAt: T0,
        version: 7,
      });
      permissions.push(UserPermission.MANAGE_USERS);
      expect(user.getPermissions()).toEqual([UserPermission.VIEW_ORDERS]);
      expect(user.getVersion()).toBe(7);
      expect(user.domainEvents).toHaveLength(0);
    });
  });
});

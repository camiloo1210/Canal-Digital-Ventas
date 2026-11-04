import { describe, expect, it } from 'vitest';
import { TenantRole } from '@/iam/domain/entities/tenant-role.entity';
import { UserPermission } from '@/iam/domain/enums/permission.enum';
import { InvalidTenantRoleException } from '@/iam/domain/exceptions/invalid-tenant-role.exception';
import { DomainException } from '@/shared/domain/exceptions/domain.exception';

const base = {
  id: 'r1',
  tenantId: 't1',
  name: 'Cajero',
  permissions: [UserPermission.VIEW_ORDERS],
};

describe('TenantRole', () => {
  it('creates a role with trimmed name and de-duplicated permissions', () => {
    const role = TenantRole.create({
      ...base,
      name: '  Cajero   senior ',
      permissions: ['VIEW_ORDERS', 'VIEW_ORDERS', 'VIEW_CATALOG'],
    });
    expect(role.getName()).toBe('Cajero senior');
    expect(role.getPermissions()).toEqual(['VIEW_ORDERS', 'VIEW_CATALOG']);
  });

  it('rejects names outside 2..40 chars', () => {
    expect(() => TenantRole.create({ ...base, name: 'a' })).toThrow(InvalidTenantRoleException);
    expect(() => TenantRole.create({ ...base, name: ' ' })).toThrow(InvalidTenantRoleException);
    expect(() => TenantRole.create({ ...base, name: 'x'.repeat(41) })).toThrow(
      InvalidTenantRoleException,
    );
    expect(() => TenantRole.create({ ...base, name: 'x'.repeat(40) })).not.toThrow();
  });

  it('rejects empty and unknown permissions with domain exceptions', () => {
    expect(() => TenantRole.create({ ...base, permissions: [] })).toThrow(
      InvalidTenantRoleException,
    );
    expect(() => TenantRole.create({ ...base, permissions: ['FLY'] })).toThrow(DomainException);
  });

  it('renames and replaces permissions keeping invariants', () => {
    const role = TenantRole.create(base);
    role.rename('Bodega');
    role.setPermissions(['MANAGE_CATALOG']);
    expect(role.getName()).toBe('Bodega');
    expect(role.hasPermission(UserPermission.MANAGE_CATALOG)).toBe(true);
    expect(role.hasPermission(UserPermission.VIEW_ORDERS)).toBe(false);
    expect(() => role.setPermissions([])).toThrow(InvalidTenantRoleException);
    expect(() => role.rename('')).toThrow(InvalidTenantRoleException);
    expect(role.getName()).toBe('Bodega');
  });
});

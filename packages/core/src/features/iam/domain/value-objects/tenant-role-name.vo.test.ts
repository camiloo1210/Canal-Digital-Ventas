import { describe, expect, it } from 'vitest';
import { TenantRoleName } from '@/iam/domain/value-objects/tenant-role-name.vo';
import { InvalidTenantRoleException } from '@/iam/domain/exceptions/invalid-tenant-role.exception';

const MESSAGE = 'Role name must be between 2 and 40 characters';

describe('TenantRoleName', (): void => {
  it.each<[string, string, string]>([
    ['minimum length', 'ab', 'ab'],
    ['maximum length', 'x'.repeat(40), 'x'.repeat(40)],
    ['surrounding whitespace', '  Cajero  ', 'Cajero'],
    ['inner whitespace collapsed', 'Cajero    senior', 'Cajero senior'],
    ['tabs and newlines collapsed', 'Cajero\t\nsenior', 'Cajero senior'],
    ['accents', 'Supervisión', 'Supervisión'],
  ])('accepts %s', (_label: string, raw: string, expected: string): void => {
    expect(TenantRoleName.create(raw).getValue()).toBe(expected);
  });

  it.each<[string, string]>([
    ['empty', ''],
    ['only spaces', '    '],
    ['one char', 'a'],
    ['one char padded', '  a  '],
    ['41 chars', 'x'.repeat(41)],
    ['41 chars after trim', `  ${'x'.repeat(41)}  `],
  ])('rejects %s', (_label: string, raw: string): void => {
    expect((): unknown => TenantRoleName.create(raw)).toThrow(InvalidTenantRoleException);
    expect((): unknown => TenantRoleName.create(raw)).toThrow(MESSAGE);
  });

  it('rejects null/undefined at runtime with the same exception', (): void => {
    expect((): unknown => TenantRoleName.create(null as unknown as string)).toThrow(
      InvalidTenantRoleException,
    );
    expect((): unknown => TenantRoleName.create(undefined as unknown as string)).toThrow(
      InvalidTenantRoleException,
    );
  });

  it('measures length after whitespace collapse', (): void => {
    expect((): unknown => TenantRoleName.create(`${'x'.repeat(39)}      y`)).toThrow(MESSAGE);
    expect(TenantRoleName.create(`${'x'.repeat(20)}      ${'y'.repeat(19)}`).getValue()).toBe(
      `${'x'.repeat(20)} ${'y'.repeat(19)}`,
    );
  });

  it('reconstitute keeps the stored value without validation', (): void => {
    expect(TenantRoleName.reconstitute('a').getValue()).toBe('a');
  });
});

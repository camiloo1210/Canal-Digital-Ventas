import { InvalidTenantRoleException } from '@/iam/domain/exceptions/invalid-tenant-role.exception';

export class TenantRoleName {
  public static readonly MIN_LENGTH = 2;
  public static readonly MAX_LENGTH = 40;

  private constructor(private readonly value: string) {}

  public static create(raw: string): TenantRoleName {
    const trimmed = (raw ?? '').trim().replace(/\s+/g, ' ');
    if (trimmed.length < TenantRoleName.MIN_LENGTH || trimmed.length > TenantRoleName.MAX_LENGTH) {
      throw new InvalidTenantRoleException(
        `Role name must be between ${TenantRoleName.MIN_LENGTH} and ${TenantRoleName.MAX_LENGTH} characters`,
      );
    }
    return new TenantRoleName(trimmed);
  }

  public static reconstitute(value: string): TenantRoleName {
    return new TenantRoleName(value);
  }

  public getValue(): string {
    return this.value;
  }
}

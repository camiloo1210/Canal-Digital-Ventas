import { InvalidTenantAttributeException } from '@/tenants/domain/exceptions/invalid-tenant-attribute.exception';

export class TenantName {
  private constructor(private readonly value: string) {}

  public static create(value: string): TenantName {
    if (!value || value.trim().length === 0) {
      throw new InvalidTenantAttributeException('Tenant name cannot be empty.');
    }
    if (value.trim().length < 3) {
      throw new InvalidTenantAttributeException('Tenant name must be at least 3 characters long.');
    }
    if (value.trim().length > 100) {
      throw new InvalidTenantAttributeException('Tenant name must not exceed 100 characters.');
    }

    return new TenantName(value.trim());
  }

  public getValue(): string {
    return this.value;
  }
}

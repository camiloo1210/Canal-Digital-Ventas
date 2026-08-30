import { InvalidTenantAttributeException } from '@/tenants/domain/exceptions/invalid-tenant-attribute.exception';

export class TenantSlug {
  private static readonly SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  private constructor(private readonly value: string) {}

  public static create(value: string): TenantSlug {
    if (!value || value.trim().length === 0) {
      throw new InvalidTenantAttributeException('Tenant slug cannot be empty.');
    }

    const trimmedValue = value.trim();

    if (trimmedValue.length < 3) {
      throw new InvalidTenantAttributeException('Tenant slug must be at least 3 characters long.');
    }
    if (trimmedValue.length > 50) {
      throw new InvalidTenantAttributeException('Tenant slug must not exceed 50 characters.');
    }

    if (!TenantSlug.SLUG_REGEX.test(trimmedValue)) {
      throw new InvalidTenantAttributeException(
        'Tenant slug can only contain lowercase alphanumeric characters and hyphens.',
      );
    }

    return new TenantSlug(trimmedValue);
  }

  public getValue(): string {
    return this.value;
  }
}

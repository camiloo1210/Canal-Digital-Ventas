import { InvalidTenantAttributeException } from '@/tenants/domain/exceptions/invalid-tenant-attribute.exception';

export enum TenantStatus {
  PENDING_SETUP = 'pending_setup',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  ARCHIVED = 'archived',
}

export function parseTenantStatus(value: string): TenantStatus {
  const values = Object.values(TenantStatus) as string[];
  if (!values.includes(value)) {
    throw new InvalidTenantAttributeException(`'${value}' is not a valid tenant status.`);
  }
  return value as TenantStatus;
}

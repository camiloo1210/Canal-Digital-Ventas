import { Brand } from '@/shared/domain/types/brand.type';
import { InvalidTenantIdException } from '@/shared/domain/exceptions/invalid-tenant-id.exception';

export type TenantId = Brand<string, 'TenantId'>;

export function createTenantId(id: string): TenantId {
  if (!id || id.trim().length === 0) {
    throw new InvalidTenantIdException('Tenant ID cannot be empty');
  }
  return id as TenantId;
}

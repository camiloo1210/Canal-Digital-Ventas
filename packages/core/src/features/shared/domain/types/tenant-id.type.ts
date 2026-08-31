import { Brand } from '@/shared/domain/types/brand.type';

export type TenantId = Brand<string, 'TenantId'>;

export function createTenantId(id: string): TenantId {
  if (!id || id.trim().length === 0) {
    throw new Error('Tenant ID cannot be empty'); // Will use base exception if they have one, or simple throw
  }
  return id as TenantId;
}

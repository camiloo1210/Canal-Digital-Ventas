import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseTenantRepository } from '@/tenants/infrastructure/repositories/supabase-tenant.repository';
import { Tenant } from '@/tenants/domain/entities/tenant.entity';
import { TenantName } from '@/tenants/domain/value-objects/tenant-name.vo';
import { TenantSlug } from '@/tenants/domain/value-objects/tenant-slug.vo';
import { Email } from '@/shared/domain/value-objects/email.vo';
import { Currency } from '@/shared/domain/enums/currency.enum';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { BusinessAccountBoundException } from '@/iam/application/exceptions/business-account-bound.exception';
import { TenantRepositoryException } from '@/tenants/application/exceptions/tenant-repository.exception';

function clientFailingWith(code: string): SupabaseClient {
  return {
    schema: () => ({ rpc: () => Promise.resolve({ error: { code, message: 'rpc failed' } }) }),
  } as unknown as SupabaseClient;
}

function tenant(): Tenant {
  return Tenant.create(
    createTenantId('33333333-3333-4333-8333-333333333333'),
    TenantName.create('Tienda Uno'),
    TenantSlug.create('tienda-uno'),
    Email.create('owner@example.com'),
    Currency.USD,
  );
}

describe('SupabaseTenantRepository.onboard', () => {
  it('maps P0004 (business account) to BusinessAccountBoundException', async () => {
    await expect(
      new SupabaseTenantRepository(clientFailingWith('P0004')).onboard(tenant(), 'u', {}, 'k'),
    ).rejects.toBeInstanceOf(BusinessAccountBoundException);
  });

  it('keeps other failures as TenantRepositoryException', async () => {
    await expect(
      new SupabaseTenantRepository(clientFailingWith('XX000')).onboard(tenant(), 'u', {}, 'k'),
    ).rejects.toBeInstanceOf(TenantRepositoryException);
  });
});

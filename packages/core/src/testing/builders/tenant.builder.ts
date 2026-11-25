import { Tenant, type TenantProps } from '@/tenants/domain/entities/tenant.entity';
import { TenantStatus } from '@/tenants/domain/enums/tenant-status.enum';
import { TenantName } from '@/tenants/domain/value-objects/tenant-name.vo';
import { TenantSlug } from '@/tenants/domain/value-objects/tenant-slug.vo';
import { Email } from '@/shared/domain/value-objects/email.vo';
import { Currency } from '@/shared/domain/enums/currency.enum';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';

/** Valid, event-free tenant (reconstituted, status ACTIVE). Deterministic: no clock, no random ids. */
export function buildTenant(overrides: Partial<TenantProps> = {}): Tenant {
  return Tenant.reconstitute({
    id: createTenantId('tenant-1'),
    name: TenantName.create('Test store'),
    slug: TenantSlug.create('test-store'),
    description: null,
    contactEmail: Email.create('store@example.com'),
    baseCurrency: Currency.COP,
    status: TenantStatus.ACTIVE,
    taxId: null,
    customDomain: null,
    logoUrl: null,
    bannerUrl: null,
    createdAt: new Date('2026-01-15T12:00:00.000Z'),
    updatedAt: new Date('2026-01-15T12:00:00.000Z'),
    version: 0,
    ...overrides,
  });
}

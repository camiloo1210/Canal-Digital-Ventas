import { Tenant } from '@/tenants/domain/entities/tenant.entity';
import { DbTenantRow } from '@/tenants/infrastructure/types/supabase-tenant.types';
import { TenantId } from '@/tenants/domain/types/tenant-id.type';
import { TenantName } from '@/tenants/domain/value-objects/tenant-name.vo';
import { TenantSlug } from '@/tenants/domain/value-objects/tenant-slug.vo';
import { Email } from '@/shared/domain/value-objects/email.vo';
import { Currency } from '@/shared/domain/enums/currency.enum';
import { TenantStatus } from '@/tenants/domain/enums/tenant-status.enum';

export class SupabaseTenantMapper {
  static toDomain(row: DbTenantRow): Tenant {
    return Tenant.reconstitute({
      id: row.id as TenantId,
      name: TenantName.create(row.name),
      slug: TenantSlug.create(row.slug),
      contactEmail: Email.create(row.contact_email),
      baseCurrency: row.base_currency as Currency,
      status: row.status as TenantStatus,
      taxId: row.tax_id,
      customDomain: row.custom_domain,
      logoUrl: row.logo_url,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      version: row.version ?? 0,
    });
  }

  static toPersistence(tenant: Tenant): DbTenantRow {
    return {
      id: tenant.getId(),
      name: tenant.getName().getValue(),
      slug: tenant.getSlug().getValue(),
      contact_email: tenant.getContactEmail().getValue(),
      base_currency: tenant.getBaseCurrency(),
      status: tenant.getStatus(),
      tax_id: tenant.getTaxId(),
      custom_domain: tenant.getCustomDomain(),
      logo_url: tenant.getLogoUrl(),
      created_at: tenant.getCreatedAt().toISOString(),
      updated_at: tenant.getUpdatedAt().toISOString(),
      version: tenant.getVersion(),
    };
  }
}

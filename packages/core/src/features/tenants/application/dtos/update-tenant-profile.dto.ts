import { TenantId } from '@/tenants/domain/types/tenant-id.type';

export interface UpdateTenantProfileDto {
  tenantId: TenantId;
  name: string;
  slug: string;
  contactEmail: string;
  taxId?: string | null;
  customDomain?: string | null;
  logoUrl?: string | null;
}

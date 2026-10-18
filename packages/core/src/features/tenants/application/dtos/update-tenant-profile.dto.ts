export interface UpdateTenantProfileDto {
  tenantId: string;
  name: string;
  slug: string;
  contactEmail: string;
  taxId?: string | null;
  customDomain?: string | null;
  logoUrl?: string | null;
}

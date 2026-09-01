export interface CreateTenantDto {
  id: string;
  name: string;
  slug: string;
  contactEmail: string;
  baseCurrency: string;
  taxId?: string | null;
  customDomain?: string | null;
  logoUrl?: string | null;
}

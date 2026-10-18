export interface DbTenantRow {
  id: string;
  name: string;
  slug: string;
  contact_email: string;
  base_currency: string;
  status: string;
  tax_id: string | null;
  custom_domain: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

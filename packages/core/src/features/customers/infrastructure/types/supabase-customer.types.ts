export interface DbCustomerRow {
  id: string;
  tenant_id: number;
  full_name: string;
  email: string;
  phone: string;
  document_id: string;
  status: string;
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    zipCode: string;
    reference?: string;
  } | null;
  created_at: string;
  updated_at: string;
  version: number;
}

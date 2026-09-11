export interface DbUserRow {
  id: string;
  tenant_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  permissions: string[];
  status: string;
  created_at: string;
  updated_at: string;
  version: number;
}

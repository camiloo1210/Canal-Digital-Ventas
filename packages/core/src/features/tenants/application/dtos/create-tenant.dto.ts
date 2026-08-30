import { TenantId } from '@/tenants/domain/types/tenant-id.type';
import { Currency } from '@/shared/domain/enums/currency.enum';

export interface CreateTenantDto {
  id: TenantId;
  name: string;
  slug: string;
  contactEmail: string;
  baseCurrency: Currency;
  taxId?: string | null;
  customDomain?: string | null;
  logoUrl?: string | null;
}

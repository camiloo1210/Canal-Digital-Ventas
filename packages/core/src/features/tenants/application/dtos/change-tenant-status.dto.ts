import { TenantId } from '@/tenants/domain/types/tenant-id.type';
import { TenantStatus } from '@/tenants/domain/enums/tenant-status.enum';

export interface ChangeTenantStatusDto {
  tenantId: TenantId;
  status: TenantStatus;
  reason?: string;
}

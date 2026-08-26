import { CustomerId } from '@/customers/domain/types/customer-id.type';
import { TenantId } from '@/customers/domain/types/tenant-id.type';
import { CustomerStatus } from '@/customers/domain/enums/customer-status.enum';

export interface ChangeCustomerStatusDto {
  customerId: CustomerId;
  tenantId: TenantId;
  status: CustomerStatus;
}

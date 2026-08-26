import { CustomerId } from '@/customers/domain/types/customer-id.type';
import { TenantId } from '@/customers/domain/types/tenant-id.type';

export interface UpdateCustomerProfileDto {
  customerId: CustomerId;
  tenantId: TenantId;
  name: string;
  phone: string;
}

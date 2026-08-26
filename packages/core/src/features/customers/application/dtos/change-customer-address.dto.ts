import { CustomerId } from '@/customers/domain/types/customer-id.type';
import { TenantId } from '@/customers/domain/types/tenant-id.type';

export interface ChangeCustomerAddressDto {
  customerId: CustomerId;
  tenantId: TenantId;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
}

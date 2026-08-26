import { CustomerId } from '@/customers/domain/types/customer-id.type';
import { TenantId } from '@/customers/domain/types/tenant-id.type';

export interface CreateCustomerDto {
  id: CustomerId;
  tenantId: TenantId;
  name: string;
  email: string;
  phone: string;
  documentId: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
}

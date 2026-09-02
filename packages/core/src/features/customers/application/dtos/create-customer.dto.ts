export interface CreateCustomerDto {
  id: string;
  tenantId: string;
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

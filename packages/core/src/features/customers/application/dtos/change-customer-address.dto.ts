export interface ChangeCustomerAddressDto {
  customerId: string;
  tenantId: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
}

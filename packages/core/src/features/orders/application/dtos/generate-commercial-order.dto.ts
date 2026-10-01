export interface GenerateCommercialOrderDto {
  buyerId: string;
  tenantSlug: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  customer: {
    name: string;
    email: string;
    phone: string;
    documentId: string;
  };
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    reference?: string;
  };
}

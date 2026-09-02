export interface GenerateCheckoutDto {
  orderId: string;
  tenantId: string;
  customerId: string;
  gateway: string;
  amount: number;
}

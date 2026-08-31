export interface CreateCartDto {
  id: string;
  tenantId: string;
  customerId: string | null;
  expiresAt: Date;
}

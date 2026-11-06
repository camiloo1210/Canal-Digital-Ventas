export interface CreateCartDto {
  id: string;
  tenantId: string;
  customerId: string | null;
  expiresAt: string;
  /** Tenant base currency (ISO 4217); never defaulted. */
  currency: string;
}

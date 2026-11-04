export interface BusinessAccountReadPort {
  /** True when the account is a business account (managed by some company). */
  isBusinessAccount(userId: string): Promise<boolean>;
  /** True when the account is a business account that is NOT managed by the given tenant. */
  isBoundToOtherTenant(userId: string, tenantId: string): Promise<boolean>;
}

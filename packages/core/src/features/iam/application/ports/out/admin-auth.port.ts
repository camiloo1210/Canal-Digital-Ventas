export interface AdminAuthPort {
  setTenantClaim(userId: string, tenantId: string): Promise<void>;
}

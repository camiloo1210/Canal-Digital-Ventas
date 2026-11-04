export interface AdminAuthPort {
  setTenantClaim(userId: string, tenantId: string): Promise<void>;

  /**
   * Creates an already-confirmed user for a business-managed account. It must not trigger any email
   * (no confirmation, no invite) because the generated address is not deliverable. The tenant is
   * recorded in app_metadata.managed_by_tenant, which end users cannot modify. Throws
   * EmailAlreadyRegisteredException on collision.
   */
  createConfirmedUser(email: string, password: string, managedByTenantId: string): Promise<string>;

  deleteUser(userId: string): Promise<void>;

  /** Replaces the auth user's password. The value must never be logged. */
  setPassword(userId: string, password: string): Promise<void>;
}

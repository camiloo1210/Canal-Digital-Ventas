export interface ActiveMembershipSummary {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: string;
}

export type ActiveTenantReadyContext = {
  status: 'ready';
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: string;
};

export type ActiveTenantContextReadModel =
  { status: 'none' | 'multiple' } | ActiveTenantReadyContext;

export interface ActiveTenantContextReadPort {
  findForUser(userId: string): Promise<ActiveTenantContextReadModel>;
  /** Every ACTIVE membership of the user, ordered by business name. */
  findAllActiveForUser(userId: string): Promise<ActiveMembershipSummary[]>;
  /** Ready context of exactly this tenant when the user holds an ACTIVE membership in it; otherwise null. */
  resolveForUser(userId: string, tenantId: string): Promise<ActiveTenantReadyContext | null>;
}

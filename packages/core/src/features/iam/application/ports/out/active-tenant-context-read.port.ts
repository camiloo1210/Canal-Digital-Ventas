export type ActiveTenantContextReadModel =
  | { status: 'none' | 'multiple' }
  | { status: 'ready'; tenantId: string; tenantName: string; tenantSlug: string; role: string };

export interface ActiveTenantContextReadPort {
  findForUser(userId: string): Promise<ActiveTenantContextReadModel>;
}

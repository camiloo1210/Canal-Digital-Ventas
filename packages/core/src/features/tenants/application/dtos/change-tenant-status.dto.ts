export interface ChangeTenantStatusDto {
  tenantId: string;
  status: string;
  reason?: string;
}

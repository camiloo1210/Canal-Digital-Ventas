export interface OnboardTenantDto {
  tenantId: string;
  name: string;
  slug: string;
  contactEmail: string;
  baseCurrency?: string;
  firstName: string;
  lastName: string;
  userEmail: string;
}

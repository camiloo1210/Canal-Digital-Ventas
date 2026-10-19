export interface TenantBrandingReadModel {
  name: string;
  slug: string;
  description: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  version: number;
}

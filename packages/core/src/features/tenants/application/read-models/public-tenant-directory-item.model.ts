export interface PublicTenantDirectoryItem {
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
}

export interface PublicTenantDirectoryResult {
  items: PublicTenantDirectoryItem[];
  total: number;
  currentPage: number;
  totalPages: number;
}

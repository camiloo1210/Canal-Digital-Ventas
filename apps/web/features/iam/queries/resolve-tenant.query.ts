import 'server-only';
import { getStoreTenantReadRepository } from '@/features/store/di/store.di';

export interface PublicTenantContext {
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
}

export async function resolveTenantQuery(slug: string): Promise<PublicTenantContext | null> {
  const repository = await getStoreTenantReadRepository();
  const data = await repository.findBySlug(slug);

  if (!data) return null;

  return {
    name: data.name,
    slug: data.slug,
    description: data.description,
    logoUrl: data.logoUrl,
    bannerUrl: data.bannerUrl,
  };
}

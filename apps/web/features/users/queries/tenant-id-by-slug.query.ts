import 'server-only';
import { getActiveTenantIdBySlugResolver } from '@/features/users/di/users.di';

/** Active store id for a public slug (userId only scopes the lookup transaction), or null when the slug is unknown or inactive. */
export async function resolveActiveTenantIdBySlugQuery(
  slug: string,
  userId: string,
): Promise<string | null> {
  return getActiveTenantIdBySlugResolver().resolve(slug, userId);
}

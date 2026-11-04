'use server';

import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { resolveActiveTenantQuery } from '@/features/iam/queries/active-tenant.query';
import { writeActiveTenantCookie } from '@/features/iam/utils/active-tenant-cookie';
import { isTenantId } from '@/features/dashboard/utils/tenant-scope';

export type SwitchTenantState =
  { success: true; tenantId: string } | { success: false; message: string };

/**
 * Remembers the business the user chose as the navigation default. The id is verified against the
 * user's ACTIVE memberships first; the cookie never grants access, it only picks a default.
 */
export async function switchTenantAction(tenantId: string): Promise<SwitchTenantState> {
  const t = await getTranslations('BusinessSwitcher');
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, message: t('unauthorized') };
    if (!isTenantId(tenantId)) return { success: false, message: t('contextChanged') };
    const context = await resolveActiveTenantQuery(user.id, tenantId);
    if (!context) return { success: false, message: t('contextChanged') };
    await writeActiveTenantCookie(context.tenantId);
    return { success: true, tenantId: context.tenantId };
  } catch (error: unknown) {
    console.error(
      '[BusinessSwitcher] switch failed',
      error instanceof Error ? error.name : 'unknown',
    );
    return { success: false, message: t('unexpected') };
  }
}

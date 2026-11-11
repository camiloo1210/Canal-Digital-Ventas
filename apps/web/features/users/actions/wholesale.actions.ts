'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { wholesaleModeSchema } from '@/features/users/schemas/wholesale.schema';
import { getSetBuyerWholesaleUseCase } from '@/features/users/di/users.di';
import { resolveAuthenticatedUserId } from '@/features/users/actions/users-actor';

export interface WholesaleActionState {
  enabled: boolean | null;
  message: string | null;
  success: boolean;
}

export async function setWholesaleAction(
  previous: WholesaleActionState,
  formData: FormData,
): Promise<WholesaleActionState> {
  const t = await getTranslations('WholesaleAccount');
  const parsed = wholesaleModeSchema.safeParse(formData.get('enabled'));
  if (!parsed.success) return { ...previous, success: false, message: t('error') };
  try {
    const userId = await resolveAuthenticatedUserId();
    if (!userId) return { ...previous, success: false, message: t('unauthorized') };
    const enabled = parsed.data === 'true';
    await getSetBuyerWholesaleUseCase().execute({ userId, enabled });
    revalidatePath('/', 'layout');
    return { enabled, success: true, message: t(enabled ? 'activated' : 'deactivated') };
  } catch (error: unknown) {
    console.error('[Users] setWholesale failed', error);
    return { ...previous, success: false, message: t('error') };
  }
}

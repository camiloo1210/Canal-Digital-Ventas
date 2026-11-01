'use server';

import { getTranslations } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import {
  KiviConnectionNotFoundException,
  KiviGatewayException,
  KiviLinkForbiddenException,
} from '@canaldigital/packages/core';
import { createClient } from '@/lib/supabase/server';
import { getActiveTenantQuery } from '@/features/iam/queries/active-tenant.query';
import { getConfigureKiviNotificationsUseCase } from '@/features/kivi/di/kivi.di';
import { kiviNotificationsSchema } from '@/features/kivi/schemas/kivi-notifications.schema';

export interface KiviNotificationsActionState {
  success: boolean;
  message: string | null;
  values?: {
    whatsappEnabled: boolean;
    widgetEnabled: boolean;
    templateName: string;
    language: string;
  };
}

export async function configureKiviNotificationsAction(
  previous: KiviNotificationsActionState,
  data: FormData,
): Promise<KiviNotificationsActionState> {
  void previous;
  const t = await getTranslations('KiviMessaging');
  const templateName = data.get('templateName');
  const language = data.get('language');
  const whatsappEnabled = data.get('whatsappEnabled');
  const widgetEnabled = data.get('widgetEnabled');
  const values = {
    whatsappEnabled: whatsappEnabled === 'on',
    widgetEnabled: widgetEnabled === 'on',
    templateName: typeof templateName === 'string' ? templateName : '',
    language: typeof language === 'string' ? language : '',
  };
  const failure = (key: string): KiviNotificationsActionState => ({
    success: false,
    message: t(key),
    values,
  });
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return failure('unauthorized');
    const tenantId = await getActiveTenantQuery(user.id);
    if (!tenantId) return failure('unauthorized');
    const parsed = kiviNotificationsSchema.safeParse({
      templateName,
      language,
      whatsappEnabled:
        whatsappEnabled === null ? false : whatsappEnabled === 'on' ? true : whatsappEnabled,
      widgetEnabled: widgetEnabled === null ? false : widgetEnabled === 'on' ? true : widgetEnabled,
    });
    if (!parsed.success) return failure('invalidTemplate');
    await getConfigureKiviNotificationsUseCase().execute({
      ...parsed.data,
      userId: user.id,
      tenantId,
    });
    revalidatePath('/dashboard/integrations');
    return { success: true, message: t('settingsSaved'), values };
  } catch (error: unknown) {
    if (error instanceof KiviLinkForbiddenException) return failure('forbidden');
    if (error instanceof KiviConnectionNotFoundException) return failure('notLinked');
    if (error instanceof KiviGatewayException && error.status === 403)
      return failure('notificationScope');
    return failure('unavailable');
  }
}

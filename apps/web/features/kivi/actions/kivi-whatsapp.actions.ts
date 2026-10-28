'use server';

import { getTranslations } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import {
  KiviGatewayException,
  KiviLinkForbiddenException,
  KiviConnectionNotFoundException,
} from '@canaldigital/packages/core';
import { createClient } from '@/lib/supabase/server';
import { getActiveTenantQuery } from '@/features/iam/queries/active-tenant.query';
import { getConfigureKiviWhatsAppUseCase } from '@/features/kivi/di/kivi.di';
import { kiviWhatsAppSchema } from '@/features/kivi/schemas/kivi-whatsapp.schema';

export interface KiviWhatsAppActionState {
  success: boolean;
  message: string | null;
  phoneNumberId?: string;
  connected?: boolean;
  fieldErrors?: Partial<Record<'phoneNumberId' | 'token', string>>;
}

export async function configureKiviWhatsAppAction(
  previous: KiviWhatsAppActionState,
  data: FormData,
): Promise<KiviWhatsAppActionState> {
  void previous;
  const t = await getTranslations('KiviMessaging');
  const phoneNumberId =
    typeof data.get('phoneNumberId') === 'string' ? String(data.get('phoneNumberId')) : '';
  const failure = (key: string): KiviWhatsAppActionState => ({
    success: false,
    message: t(key),
    phoneNumberId,
  });
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return failure('unauthorized');
    const tenantId = await getActiveTenantQuery(user.id);
    if (!tenantId) return failure('unauthorized');
    const parsed = kiviWhatsAppSchema.safeParse({
      operation: data.get('operation'),
      phoneNumberId: data.get('phoneNumberId'),
      token: data.get('token'),
    });
    if (!parsed.success) {
      const fieldErrors: KiviWhatsAppActionState['fieldErrors'] = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === 'phoneNumberId' || field === 'token')
          fieldErrors[field] = t(`validation.${field}`);
      }
      return { ...failure('invalidInput'), fieldErrors };
    }
    const input = parsed.data;
    const result = await getConfigureKiviWhatsAppUseCase().execute({
      userId: user.id,
      tenantId,
      operation: input.operation,
      phoneNumberId: input.operation === 'disconnect' ? '' : input.phoneNumberId,
      token: input.operation === 'disconnect' ? '' : input.token,
    });
    revalidatePath('/dashboard/integrations');
    return {
      success: true,
      message: t(
        input.operation === 'validate'
          ? 'validated'
          : input.operation === 'connect'
            ? 'connected'
            : 'disconnected',
      ),
      phoneNumberId,
      ...(input.operation === 'validate' ? {} : { connected: result.connected }),
    };
  } catch (error: unknown) {
    if (error instanceof KiviLinkForbiddenException) return failure('forbidden');
    if (error instanceof KiviConnectionNotFoundException) return failure('notLinked');
    if (error instanceof KiviGatewayException)
      return failure(
        error.status === 403
          ? 'missingScope'
          : error.status === 400
            ? 'invalidCredentials'
            : error.status === 409
              ? 'numberConflict'
              : 'unavailable',
      );
    return failure('unavailable');
  }
}

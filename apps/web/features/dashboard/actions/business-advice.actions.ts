'use server';

import { getLocale, getTranslations } from 'next-intl/server';
import {
  BusinessAdviceAccessDeniedException,
  BusinessAdvisorException,
  UserPermission,
  type BusinessAdvice,
} from '@canaldigital/packages/core';
import { createClient } from '@/lib/supabase/server';
import { resolveActionTenant } from '@/features/dashboard/server/resolve-action-tenant';
import { userHasAnyPermission } from '@/features/users/queries/member-permissions.query';
import { getGenerateBusinessAdviceUseCase } from '@/features/dashboard/di/dashboard.di';
import { parseIntelligenceQuery } from '@/features/dashboard/queries/business-intelligence-query';

export type BusinessAdviceErrorCode =
  'UNAUTHORIZED' | 'NOT_CONFIGURED' | 'UNAVAILABLE' | 'UNEXPECTED';

export interface BusinessAdviceActionState {
  readonly status: 'idle' | 'success' | 'error';
  readonly errorCode: BusinessAdviceErrorCode | null;
  readonly message: string | null;
  readonly advice: BusinessAdvice | null;
  /** Bumps on every run so the client can tell a fresh answer from a stale one. */
  readonly revision: number;
}

const FIELDS = ['days', 'from', 'to', 'leadTimeDays', 'targetCoverageDays'] as const;

export async function generateBusinessAdviceAction(
  previous: BusinessAdviceActionState,
  formData: FormData,
): Promise<BusinessAdviceActionState> {
  const t = await getTranslations('BusinessIntelligence');
  const fail = (
    errorCode: BusinessAdviceErrorCode,
    message: string,
  ): BusinessAdviceActionState => ({
    status: 'error',
    errorCode,
    message,
    advice: null,
    revision: previous.revision + 1,
  });
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return fail('UNAUTHORIZED', t('advisorUnauthorized'));
    const tenant = await resolveActionTenant(formData, user.id);
    if (!tenant) return fail('UNAUTHORIZED', t('advisorUnauthorized'));
    if (!(await userHasAnyPermission(user.id, tenant.tenantId, [UserPermission.VIEW_REPORTS])))
      return fail('UNAUTHORIZED', t('advisorUnauthorized'));
    const raw: Record<string, string> = {};
    for (const field of FIELDS) {
      const value = formData.get(field);
      if (typeof value === 'string') raw[field] = value;
    }
    const advice = await getGenerateBusinessAdviceUseCase().execute({
      authenticatedUserId: user.id,
      tenantId: tenant.tenantId,
      ...parseIntelligenceQuery(raw),
      locale: (await getLocale()) === 'en' ? 'en' : 'es',
    });
    return {
      status: 'success',
      errorCode: null,
      message: null,
      advice,
      revision: previous.revision + 1,
    };
  } catch (error: unknown) {
    if (error instanceof BusinessAdviceAccessDeniedException)
      return fail('UNAUTHORIZED', t('advisorUnauthorized'));
    if (error instanceof BusinessAdvisorException) {
      console.error('[BusinessAdvice]', error.reason, error.originalError);
      return error.reason === 'not_configured'
        ? fail('NOT_CONFIGURED', t('advisorNotConfigured'))
        : fail('UNAVAILABLE', t('advisorUnavailable'));
    }
    console.error('[BusinessAdvice]', error);
    return fail('UNEXPECTED', t('advisorUnexpected'));
  }
}

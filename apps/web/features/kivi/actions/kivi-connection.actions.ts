'use server';

import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import {
  UserPermission,
  InvalidKiviPairingCodeException,
  KiviConfigurationException,
  KiviConnectionNotFoundException,
  KiviLinkForbiddenException,
  KiviPairingException,
} from '@canaldigital/packages/core';
import { createClient } from '@/lib/supabase/server';
import { resolveActionTenant } from '@/features/dashboard/server/resolve-action-tenant';
import { userHasAnyPermission } from '@/features/users/queries/member-permissions.query';
import {
  getPairStoreWithKiviUseCase,
  getRegisterKiviToolsUseCase,
  getRequestKiviSyncUseCase,
  getUnlinkStoreFromKiviUseCase,
} from '@/features/kivi/di/kivi.di';
import { pairKiviSchema } from '@/features/kivi/schemas/kivi-connection.schema';

export type KiviConnectionErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONTEXT_CHANGED'
  | 'INVALID_INPUT'
  | 'INVALID_CODE'
  | 'RATE_LIMITED'
  | 'UNAVAILABLE'
  | 'NOT_CONFIGURED'
  | 'NOT_LINKED'
  | 'UNEXPECTED';

export type KiviField = 'code';

/**
 * Deliberately carries no submitted values: neither the pairing code nor a pasted token is ever
 * echoed back to the browser.
 */
export interface KiviConnectionActionState {
  success: boolean;
  message: string | null;
  errorCode?: KiviConnectionErrorCode;
  revision?: number;
  fieldErrors?: Partial<Record<KiviField, string[]>>;
}

const PATH = '/dashboard/integrations';

interface Actor {
  userId: string;
  tenantId: string;
}

/**
 * The actor comes from the session. The business is the one the page named in the hidden
 * `tenantId` field, accepted only after verifying the actor's active membership and permission
 * in exactly that business; otherwise `CONTEXT_CHANGED` (stale tab) or null (not allowed).
 */
async function resolveActor(formData: FormData): Promise<Actor | 'CONTEXT_CHANGED' | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const tenant = await resolveActionTenant(formData, user.id);
  if (!tenant) return 'CONTEXT_CHANGED';
  if (!(await userHasAnyPermission(user.id, tenant.tenantId, [UserPermission.MANAGE_INTEGRATIONS])))
    return null;
  return { userId: user.id, tenantId: tenant.tenantId };
}

function failure(
  previous: KiviConnectionActionState,
  errorCode: KiviConnectionErrorCode,
  message: string,
  extra: Pick<KiviConnectionActionState, 'fieldErrors'> = {},
): KiviConnectionActionState {
  return { success: false, errorCode, message, revision: (previous.revision ?? 0) + 1, ...extra };
}

function succeeded(
  previous: KiviConnectionActionState,
  message: string,
): KiviConnectionActionState {
  return { success: true, message, revision: (previous.revision ?? 0) + 1 };
}

function refresh(): void {
  try {
    revalidatePath(PATH);
  } catch (error: unknown) {
    // The transaction already committed; a cache failure must not report a failed mutation.
    console.error('[Kivi] Cache refresh failed after saving.', {
      errorType: error instanceof Error ? error.name : 'Unknown',
    });
  }
}

type Translate = Awaited<ReturnType<typeof getTranslations>>;

function mapError(
  previous: KiviConnectionActionState,
  error: unknown,
  t: Translate,
): KiviConnectionActionState {
  if (error instanceof KiviLinkForbiddenException)
    return failure(previous, 'FORBIDDEN', t('forbidden'));
  if (error instanceof KiviConnectionNotFoundException)
    return failure(previous, 'NOT_LINKED', t('notLinked'));
  if (error instanceof InvalidKiviPairingCodeException)
    return failure(previous, 'INVALID_INPUT', t('invalidInput'), {
      fieldErrors: { code: [t('validation.codeFormat')] },
    });
  if (error instanceof KiviPairingException) {
    if (error.failure === 'invalid_or_expired_code') {
      return failure(previous, 'INVALID_CODE', t('errors.invalidOrExpired'), {
        fieldErrors: { code: [t('errors.invalidOrExpired')] },
      });
    }
    if (error.failure === 'rate_limited')
      return failure(previous, 'RATE_LIMITED', t('errors.rateLimited'));
    return failure(previous, 'UNAVAILABLE', t('errors.unavailable'));
  }
  if (error instanceof KiviConfigurationException) {
    // Static line: the exception names a variable, never a value, but the browser sees neither.
    console.error('[Kivi] Platform configuration is incomplete.');
    return failure(previous, 'NOT_CONFIGURED', t('errors.notConfigured'));
  }
  return failure(previous, 'UNEXPECTED', t('unexpected'));
}

/** Client-facing origin of this request, or null when the host is unknown. */
async function requestPublicOrigin(): Promise<string | null> {
  const requestHeaders = await headers();
  // Proxies may send comma-separated lists; the first value is the client-facing one.
  const host = (requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host'))
    ?.split(',')[0]
    ?.trim();
  const protocol =
    requestHeaders.get('x-forwarded-proto')?.split(',')[0]?.trim() ??
    (host?.startsWith('localhost') ? 'http' : 'https');
  return host ? `${protocol}://${host}` : null;
}

export async function pairKiviAction(
  previous: KiviConnectionActionState,
  formData: FormData,
): Promise<KiviConnectionActionState> {
  const t = await getTranslations('KiviConnection');
  try {
    const actor = await resolveActor(formData);
    if (actor === 'CONTEXT_CHANGED')
      return failure(previous, 'CONTEXT_CHANGED', t('contextChanged'));
    if (!actor) return failure(previous, 'UNAUTHORIZED', t('unauthorized'));
    const parsed = pairKiviSchema.safeParse({ code: String(formData.get('code') ?? '') });
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'codeFormat';
      return failure(previous, 'INVALID_INPUT', t('invalidInput'), {
        fieldErrors: { code: [t(`validation.${message}`)] },
      });
    }
    await getPairStoreWithKiviUseCase().execute({
      ...actor,
      code: parsed.data.code,
      publicOrigin: await requestPublicOrigin(),
    });
    refresh();
    return succeeded(previous, t('paired'));
  } catch (error: unknown) {
    return mapError(previous, error, t);
  }
}

export async function unlinkKiviAction(
  previous: KiviConnectionActionState,
  formData: FormData,
): Promise<KiviConnectionActionState> {
  const t = await getTranslations('KiviConnection');
  try {
    const actor = await resolveActor(formData);
    if (actor === 'CONTEXT_CHANGED')
      return failure(previous, 'CONTEXT_CHANGED', t('contextChanged'));
    if (!actor) return failure(previous, 'UNAUTHORIZED', t('unauthorized'));
    await getUnlinkStoreFromKiviUseCase().execute(actor);
    refresh();
    return succeeded(previous, t('unlinked'));
  } catch (error: unknown) {
    return mapError(previous, error, t);
  }
}

export async function requestKiviSyncAction(
  previous: KiviConnectionActionState,
  formData: FormData,
): Promise<KiviConnectionActionState> {
  const t = await getTranslations('KiviConnection');
  try {
    const actor = await resolveActor(formData);
    if (actor === 'CONTEXT_CHANGED')
      return failure(previous, 'CONTEXT_CHANGED', t('contextChanged'));
    if (!actor) return failure(previous, 'UNAUTHORIZED', t('unauthorized'));
    await getRequestKiviSyncUseCase().execute(actor);
    // Keeps the assistant's tools current without re-pairing. Never fails the sync request.
    try {
      await getRegisterKiviToolsUseCase().execute({
        ...actor,
        publicOrigin: await requestPublicOrigin(),
      });
    } catch {
      // Tools are optional; the catalog sync was already requested.
    }
    refresh();
    return succeeded(previous, t('syncRequested'));
  } catch (error: unknown) {
    return mapError(previous, error, t);
  }
}

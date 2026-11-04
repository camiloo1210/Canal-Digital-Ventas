import 'server-only';
import type { GoogleInviteCookie } from '@/features/users/google-invite-cookie';
import {
  getAcceptInvitationUseCase,
  getBusinessAccountReadRepository,
  getGetInvitationPreviewUseCase,
} from '@/features/users/di/users.di';
import { usersErrorKey } from '@/features/users/actions/users-actor';
import { INVITE_PAGE_ERROR_CODES } from '@/features/users/constants';

export type GoogleInvitationResult = { ok: true } | { ok: false; error: string };

/** Maps a Core failure to a code the invitation page is allowed to display. */
function pageErrorCode(error: unknown): string {
  const key = usersErrorKey(error);
  return INVITE_PAGE_ERROR_CODES.includes(key) ? key : 'unexpected';
}

/**
 * Called by the OAuth callback once the Google session exists: applies the invitation to the
 * session user. The invitation must still be usable and must be a GOOGLE one.
 */
export async function completeGoogleInvitation(
  cookie: GoogleInviteCookie,
  userId: string,
): Promise<GoogleInvitationResult> {
  try {
    const preview = await getGetInvitationPreviewUseCase().execute(cookie.token);
    if (!preview) return { ok: false, error: 'invitationNotUsable' };
    if (preview.accountMode !== 'GOOGLE') return { ok: false, error: 'modeMismatch' };
    if (await getBusinessAccountReadRepository().isBoundToOtherTenant(userId, preview.tenantId)) {
      return { ok: false, error: 'businessAccountBound' };
    }
    await getAcceptInvitationUseCase().execute({
      token: cookie.token,
      userId,
      demographicConsent: cookie.consent,
      ageRange: cookie.ageRange,
      gender: cookie.gender,
      province: cookie.province,
    });
    return { ok: true };
  } catch (error: unknown) {
    const code = pageErrorCode(error);
    if (code === 'unexpected') console.error('[Users] Google invitation acceptance failed', error);
    return { ok: false, error: code };
  }
}

'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { authenticationLimitMessage } from '@/lib/security/authentication-rate-limit';
import { getGetOAuthSignInUrlUseCase } from '@/features/iam/di/iam.di';
import { getGetInvitationPreviewUseCase } from '@/features/users/di/users.di';
import { acceptAsCurrentUserSchema } from '@/features/users/schemas/users.schema';
import { serializeGoogleInviteCookie } from '@/features/users/google-invite-cookie';
import {
  INVITE_GOOGLE_COOKIE,
  INVITE_GOOGLE_COOKIE_MAX_AGE_SECONDS,
} from '@/features/users/constants';

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{20,200}$/;

function text(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === 'string' ? value : '';
}

function invitePath(token: string, error: string): string {
  return TOKEN_SHAPE.test(token) ? `/invite/${token}?error=${error}` : '/';
}

/**
 * "Continue with Google" on a GOOGLE invitation. The token and the consent choices must survive the
 * trip to Google, so they travel in a short-lived httpOnly cookie that the OAuth callback validates.
 */
export async function startGoogleInvitationAction(data: FormData): Promise<void> {
  const token = text(data, 'token').trim();
  if (await authenticationLimitMessage()) redirect(invitePath(token, 'rateLimited'));

  const consent = text(data, 'consent') === 'on';
  const parsed = acceptAsCurrentUserSchema.safeParse({
    token,
    consent: consent ? 'on' : '',
    ageRange: consent ? text(data, 'ageRange') : '',
    gender: consent ? text(data, 'gender') : '',
    province: consent ? text(data, 'province') : '',
  });
  if (!parsed.success || !TOKEN_SHAPE.test(token)) {
    redirect(invitePath(token, 'invalidInput'));
  }

  let failure: string | null = null;
  let url: string | null = null;
  try {
    const input = parsed.data;
    const preview = await getGetInvitationPreviewUseCase().execute(input.token);
    if (!preview) {
      failure = 'invitationNotUsable';
    } else if (preview.accountMode !== 'GOOGLE') {
      failure = 'modeMismatch';
    } else {
      const cookieStore = await cookies();
      cookieStore.set(
        INVITE_GOOGLE_COOKIE,
        serializeGoogleInviteCookie({
          token: input.token,
          consent: input.consent,
          ...(input.consent && input.ageRange ? { ageRange: input.ageRange } : {}),
          ...(input.consent && input.gender ? { gender: input.gender } : {}),
          ...(input.consent && input.province ? { province: input.province } : {}),
        }),
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: INVITE_GOOGLE_COOKIE_MAX_AGE_SECONDS,
          path: '/',
        },
      );
      const requestHeaders = await headers();
      const host = requestHeaders.get('host');
      const protocol = requestHeaders.get('x-forwarded-proto') || 'https';
      url = await (
        await getGetOAuthSignInUrlUseCase()
      ).execute({ provider: 'google', redirectTo: `${protocol}://${host}/auth/callback` });
    }
  } catch (error: unknown) {
    console.error('[Users] Google invitation start failed', error);
    failure = 'googleStartFailed';
  }

  if (failure || !url) {
    if (failure === 'googleStartFailed') (await cookies()).delete(INVITE_GOOGLE_COOKIE);
    redirect(invitePath(token, failure ?? 'googleStartFailed'));
  }
  redirect(url);
}

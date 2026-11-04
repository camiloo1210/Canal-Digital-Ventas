import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getExchangeOAuthCodeUseCase } from '@/features/iam/di/iam.di';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { OAUTH_INTENT_COOKIE, OAUTH_RETURN_COOKIE } from '@/features/iam/constants';
import { safeAuthReturnPath, buyerAuthHref } from '@/features/iam/utils/auth-return-path';
import { INVITE_GOOGLE_COOKIE } from '@/features/users/constants';
import { parseGoogleInviteCookie } from '@/features/users/google-invite-cookie';

const oauthQuerySchema = z.object({
  code: z.string().min(1, 'Authorization code is missing'),
});

export async function GET(request: Request): Promise<NextResponse> {
  const requestUrl = new URL(request.url);
  const codeParam = requestUrl.searchParams.get('code');
  const cookieStore = await cookies();
  const requestedReturn = cookieStore.get(OAUTH_RETURN_COOKIE)?.value;
  const returnPath = safeAuthReturnPath(requestedReturn);
  cookieStore.delete(OAUTH_RETURN_COOKIE);

  // A pending Google invitation (set by startGoogleInvitationAction). One use: always cleared, and
  // its contents are re-validated here because cookies are client-controlled input.
  const rawInviteCookie = cookieStore.get(INVITE_GOOGLE_COOKIE)?.value;
  if (rawInviteCookie !== undefined) cookieStore.delete(INVITE_GOOGLE_COOKIE);
  const pendingInvite = parseGoogleInviteCookie(rawInviteCookie);
  const inviteRedirect = (error: string): NextResponse =>
    NextResponse.redirect(
      new URL(`/invite/${pendingInvite?.token ?? ''}?error=${error}`, requestUrl.origin),
    );

  const validation = oauthQuerySchema.safeParse({ code: codeParam });

  if (validation.success) {
    try {
      const useCase = await getExchangeOAuthCodeUseCase();
      await useCase.execute(validation.data.code);
    } catch (error) {
      console.error('Error exchanging code:', error);
      if (pendingInvite) return inviteRedirect('googleFailed');
      return NextResponse.redirect(
        new URL(`${buyerAuthHref('/login', returnPath)}&error=auth_failed`, requestUrl.origin),
      );
    }
  }

  // Auth is successful (session created), now check Intent
  const intent = cookieStore.get(OAUTH_INTENT_COOKIE)?.value;

  // Consume (delete) the intent immediately
  if (intent) {
    cookieStore.delete(OAUTH_INTENT_COOKIE);
  }

  // Check if they already have a tenant
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (pendingInvite) {
    if (!user) return inviteRedirect('googleFailed');
    // Loaded on demand: ordinary sign-ins never need the invitation (database) wiring.
    const { completeGoogleInvitation } = await import('@/features/users/google-invitation');
    const result = await completeGoogleInvitation(pendingInvite, user.id);
    return result.ok
      ? NextResponse.redirect(new URL('/dashboard', requestUrl.origin))
      : inviteRedirect(result.error);
  }

  if (!user) {
    return NextResponse.redirect(
      new URL(
        `${buyerAuthHref('/login', returnPath)}&error=auth_session_missing`,
        requestUrl.origin,
      ),
    );
  }

  // V5: Query tenant_memberships (Single Source of Truth)
  // RLS allows the authenticated user to read their own active memberships
  const { data: memberships, error } = await supabase
    .schema('core')
    .from('tenant_memberships')
    .select('tenant_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1);

  if (error) {
    console.error('[auth/callback] Failed to check tenant membership:', error);
  }

  const hasTenant = (memberships?.length ?? 0) > 0;

  // Routing according to intent + UX rules
  if (intent === 'business') {
    if (hasTenant) {
      return NextResponse.redirect(`${requestUrl.origin}/dashboard`);
    }
    return NextResponse.redirect(`${requestUrl.origin}/onboarding`);
  }

  if (intent === 'customer') {
    return NextResponse.redirect(
      new URL(requestedReturn ? returnPath : hasTenant ? '/dashboard' : '/', requestUrl.origin),
    );
  }

  // Fallback if no intent (e.g. direct callback navigation)
  if (hasTenant) {
    return NextResponse.redirect(`${requestUrl.origin}/dashboard`);
  }

  // Default to buyer storefront if no tenant
  return NextResponse.redirect(`${requestUrl.origin}/`);
}

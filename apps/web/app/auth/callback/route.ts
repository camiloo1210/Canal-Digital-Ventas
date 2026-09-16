import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getExchangeOAuthCodeUseCase } from '@/features/iam/di/iam.di';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { OAUTH_INTENT_COOKIE } from '@/features/iam/constants';

const oauthQuerySchema = z.object({
  code: z.string().min(1, 'Authorization code is missing'),
});

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const codeParam = requestUrl.searchParams.get('code');

  const validation = oauthQuerySchema.safeParse({ code: codeParam });

  if (validation.success) {
    try {
      const useCase = await getExchangeOAuthCodeUseCase();
      await useCase.execute(validation.data.code);
    } catch (error) {
      console.error('Error exchanging code:', error);
      return NextResponse.redirect(`${requestUrl.origin}/login?message=Authentication failed`);
    }
  }

  // Auth is successful (session created), now check Intent
  const cookieStore = await cookies();
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

  if (!user) {
    return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_session_missing`);
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
    if (hasTenant) {
      return NextResponse.redirect(`${requestUrl.origin}/dashboard`);
    }
    return NextResponse.redirect(`${requestUrl.origin}/`);
  }

  // Fallback if no intent (e.g. direct callback navigation)
  if (hasTenant) {
    return NextResponse.redirect(`${requestUrl.origin}/dashboard`);
  }

  // Default to buyer storefront if no tenant
  return NextResponse.redirect(`${requestUrl.origin}/`);
}

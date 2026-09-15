import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getExchangeOAuthCodeUseCase, getServiceRoleClient } from '@/features/iam/di/iam.di';
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

  const tenantId = user?.app_metadata?.app_tenant_id;

  if (intent === 'business') {
    if (!tenantId) {
      return NextResponse.redirect(`${requestUrl.origin}/onboarding`);
    }
    return NextResponse.redirect(`${requestUrl.origin}/dashboard`);
  }

  if (intent === 'customer') {
    return NextResponse.redirect(`${requestUrl.origin}/`);
  }

  // Fallback if no intent (maybe session already existed, or direct callback navigation)
  if (tenantId) {
    return NextResponse.redirect(`${requestUrl.origin}/dashboard`);
  }

  // If no intent and no tenantId in JWT, check the database for their true state
  // We use the service role key to bypass RLS to check their true state.
  const serviceClient = getServiceRoleClient();

  const { data: dbUser } = await serviceClient
    .schema('core')
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (dbUser && dbUser.role === 'OWNER') {
    return NextResponse.redirect(`${requestUrl.origin}/onboarding`);
  }

  // Default to buyer storefront if no tenant, no intent, and no OWNER record
  return NextResponse.redirect(`${requestUrl.origin}/`);
}

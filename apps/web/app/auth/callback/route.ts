import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getExchangeOAuthCodeUseCase } from '@/features/iam/di/iam.di';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

const OAUTH_INTENT_COOKIE = 'auth_intent';

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
  const tenantId = user?.app_metadata?.tenantId;

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

  // Default to buyer storefront if no tenant and no explicit business intent
  return NextResponse.redirect(`${requestUrl.origin}/`);
}

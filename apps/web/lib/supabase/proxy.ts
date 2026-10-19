import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { safeAuthReturnPath } from '@/features/iam/utils/auth-return-path';

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute =
    request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/auth') ||
    request.nextUrl.pathname.startsWith('/signup');
  const isOnboardingPath = request.nextUrl.pathname.startsWith('/onboarding');
  const isDashboardRoute = request.nextUrl.pathname.startsWith('/dashboard');

  // Only catalog and product detail are public; checkout remains authenticated.
  const isPublicStoreRoute = /^\/store\/[^/]+(?:\/products\/[^/]+)?\/?$/.test(
    request.nextUrl.pathname,
  );
  const isPublicRoute =
    isAuthRoute || isPublicStoreRoute || request.nextUrl.pathname.startsWith('/api');
  // Under V5, we query tenant_memberships instead of trusting JWT claims
  let hasTenant = false;
  if (user && (isDashboardRoute || isOnboardingPath || isAuthRoute)) {
    const { data, error } = await supabase
      .schema('core')
      .from('tenant_memberships')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1);

    if (error) {
      console.error('[proxy] Failed to check tenant membership:', error);
    }

    hasTenant = !!(data && data.length > 0);
  }

  // 1. Authenticated?
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set(
      'redirectTo',
      safeAuthReturnPath(`${request.nextUrl.pathname}${request.nextUrl.search}`),
    );
    return NextResponse.redirect(url);
  }

  // 2. Routing for Authenticated Users
  if (user) {
    // Protected Business Route -> No Tenant -> Redirect to Onboarding
    if (isDashboardRoute && !hasTenant) {
      const url = request.nextUrl.clone();
      url.pathname = '/onboarding';
      return NextResponse.redirect(url);
    }

    // Onboarding Route -> Has Tenant -> Redirect to Dashboard
    if (isOnboardingPath && hasTenant) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }

    // Auth Routes -> Logged in -> Redirect away from auth forms
    if (isAuthRoute && !request.nextUrl.pathname.startsWith('/auth/callback')) {
      const destination = safeAuthReturnPath(
        request.nextUrl.searchParams.get('redirectTo'),
        hasTenant ? '/dashboard' : '/',
      );
      const url = new URL(destination, request.url);
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

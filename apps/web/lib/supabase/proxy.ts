import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
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

  // Any route that doesn't strictly require authentication
  // Note: /storefront is considered public, as buyers can browse without an account
  const isPublicRoute = isAuthRoute || request.nextUrl.pathname.startsWith('/storefront');
  // Under V5, we query tenant_memberships instead of trusting JWT claims
  let hasTenant = false;
  if (user && (isDashboardRoute || isOnboardingPath || isAuthRoute)) {
    const { data, error } = await supabase
      .schema('core')
      .from('tenant_memberships')
      .select('tenant_id')
      .eq('user_id', user.id)
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
      const url = request.nextUrl.clone();
      url.pathname = hasTenant ? '/dashboard' : '/';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

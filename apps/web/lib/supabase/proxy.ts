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
  const isOnboardingRoute = request.nextUrl.pathname.startsWith('/onboarding');
  const isDashboardRoute = request.nextUrl.pathname.startsWith('/dashboard');
  const isStoreRoute = request.nextUrl.pathname.startsWith('/store');
  const isBuyerRoute = request.nextUrl.pathname.startsWith('/buyer-dashboard');

  const isPublicRoute = isAuthRoute || isStoreRoute;
  const hasTenant = !!user?.app_metadata?.app_tenant_id;
  const isOwner = user?.app_metadata?.role === 'OWNER';

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user) {
    // Si es un B2B Owner y no tiene tenant, DEBE ir al onboarding
    if (
      isOwner &&
      !hasTenant &&
      !isOnboardingRoute &&
      !request.nextUrl.pathname.startsWith('/auth/callback')
    ) {
      const url = request.nextUrl.clone();
      url.pathname = '/onboarding';
      return NextResponse.redirect(url);
    }

    // Si es un Owner que ya tiene tenant, NO debe entrar al onboarding
    if (isOwner && hasTenant && isOnboardingRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }

    // Prevención de acceso: Buyers no entran al dashboard, Owners no entran al buyer-dashboard
    if (!isOwner && isDashboardRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/buyer-dashboard';
      return NextResponse.redirect(url);
    }

    if (isOwner && isBuyerRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }

    // Si entra a la raíz o al login, redirigir al dashboard correcto
    if (
      request.nextUrl.pathname === '/' ||
      (isAuthRoute && !request.nextUrl.pathname.startsWith('/auth/callback'))
    ) {
      const url = request.nextUrl.clone();
      if (isOwner) {
        url.pathname = hasTenant ? '/dashboard' : '/onboarding';
      } else {
        url.pathname = '/buyer-dashboard'; // TODO: handle specific store redirects if applicable
      }
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';
import { checkRequestRateLimit } from '@/lib/security/request-rate-limit';
import { reportSecurityDecision } from '@/lib/security/security-telemetry';
import es from '@/messages/es.json';
import en from '@/messages/en.json';

export async function proxy(request: NextRequest, event: NextFetchEvent): Promise<NextResponse> {
  const decision = await checkRequestRateLimit(request);
  if (decision) {
    event.waitUntil(reportSecurityDecision(decision));
    const messages = request.cookies.get('NEXT_LOCALE')?.value === 'en' ? en.Security : es.Security;
    return NextResponse.json(
      {
        errorCode: decision.status === 429 ? 'RATE_LIMITED' : 'SECURITY_UNAVAILABLE',
        message: decision.status === 429 ? messages.rateLimited : messages.unavailable,
      },
      {
        status: decision.status,
        headers: { 'Retry-After': String(decision.retryAfter), 'Cache-Control': 'no-store' },
      },
    );
  }
  const response = await updateSession(request);
  if (!request.cookies.has('NEXT_LOCALE')) {
    response.cookies.set('NEXT_LOCALE', 'es');
  }
  return response;
}

export const config = {
  matcher: [
    // Dynamic routes can end in .png too; exclude only known public assets.
    '/((?!_next/static/|_next/image$|favicon\\.ico$|Logo\\.svg$|next\\.svg$|vercel\\.svg$|file\\.svg$|globe\\.svg$|window\\.svg$).*)',
  ],
};

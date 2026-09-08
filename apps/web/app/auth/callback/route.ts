import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SupabaseAuthAdapter } from '@canaldigital/packages/core/src/features/iam/infrastructure/adapters/supabase-auth.adapter';
import { ExchangeOAuthCodeUseCase } from '@canaldigital/packages/core/src/features/iam/application/use-cases/exchange-oauth-code.use-case';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const client = await createClient();
    const adapter = new SupabaseAuthAdapter();
    const useCase = new ExchangeOAuthCodeUseCase(adapter);

    try {
      await useCase.execute(code, client);
    } catch (error) {
      console.error('Error exchanging code:', error);
      return NextResponse.redirect(`${requestUrl.origin}/login?message=Authentication failed`);
    }
  }

  // Si no hay código o el intercambio fue exitoso, redirigimos a home
  return NextResponse.redirect(`${requestUrl.origin}/`);
}

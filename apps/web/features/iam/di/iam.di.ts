import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import {
  SignInWithEmailUseCase,
  GetOAuthSignInUrlUseCase,
  ExchangeOAuthCodeUseCase,
  SupabaseAuthAdapter,
} from '@canaldigital/packages/core';

async function createSupabaseClient() {
  const cookieStore = await cookies();

  // Environment variables must be asserted as strings in a real-world production app
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    },
  });
}

export async function getSignInWithEmailUseCase(): Promise<SignInWithEmailUseCase> {
  const supabaseClient = await createSupabaseClient();
  const adapter = new SupabaseAuthAdapter(supabaseClient);
  return new SignInWithEmailUseCase(adapter);
}

export async function getGetOAuthSignInUrlUseCase(): Promise<GetOAuthSignInUrlUseCase> {
  const supabaseClient = await createSupabaseClient();
  const adapter = new SupabaseAuthAdapter(supabaseClient);
  return new GetOAuthSignInUrlUseCase(adapter);
}

export async function getExchangeOAuthCodeUseCase(): Promise<ExchangeOAuthCodeUseCase> {
  const supabaseClient = await createSupabaseClient();
  const adapter = new SupabaseAuthAdapter(supabaseClient);
  return new ExchangeOAuthCodeUseCase(adapter);
}

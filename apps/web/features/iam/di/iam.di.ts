import 'server-only';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';
import {
  SignInWithEmailUseCase,
  GetOAuthSignInUrlUseCase,
  ExchangeOAuthCodeUseCase,
  SupabaseAuthAdapter,
  SupabaseTenantRepository,
  SupabaseUserRepository,
  OnboardTenantUseCase,
  LocalEventBus,
  RegisterGlobalIdentityUseCase,
} from '@canaldigital/packages/core';

export async function getSignInWithEmailUseCase(): Promise<SignInWithEmailUseCase> {
  const supabaseClient = await createSupabaseServerClient();
  const adapter = new SupabaseAuthAdapter(supabaseClient);
  return new SignInWithEmailUseCase(adapter);
}

export async function getGetOAuthSignInUrlUseCase(): Promise<GetOAuthSignInUrlUseCase> {
  const supabaseClient = await createSupabaseServerClient();
  const adapter = new SupabaseAuthAdapter(supabaseClient);
  return new GetOAuthSignInUrlUseCase(adapter);
}

export async function getExchangeOAuthCodeUseCase(): Promise<ExchangeOAuthCodeUseCase> {
  const supabaseClient = await createSupabaseServerClient();
  const adapter = new SupabaseAuthAdapter(supabaseClient);
  return new ExchangeOAuthCodeUseCase(adapter);
}

export async function getOnboardTenantUseCase() {
  // 1. SAFE CLIENT: Uses cookies, respects Row Level Security (RLS)
  const userClient = await createSupabaseServerClient();
  const tenantRepository = new SupabaseTenantRepository(userClient);
  const userRepository = new SupabaseUserRepository(userClient);
  const eventBus = new LocalEventBus();

  // 2. Assemble: The Use Case gets exactly the privileges it needs.
  return new OnboardTenantUseCase(tenantRepository, userRepository, eventBus);
}

export async function getRegisterGlobalIdentityUseCase() {
  const supabaseClient = await createSupabaseServerClient();
  const adapter = new SupabaseAuthAdapter(supabaseClient);
  return new RegisterGlobalIdentityUseCase(adapter);
}

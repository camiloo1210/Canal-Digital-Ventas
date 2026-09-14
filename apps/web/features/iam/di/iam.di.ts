import 'server-only';
import { createClient as createBaseSupabaseClient } from '@supabase/supabase-js';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';
import {
  SignInWithEmailUseCase,
  GetOAuthSignInUrlUseCase,
  ExchangeOAuthCodeUseCase,
  SupabaseAuthAdapter,
  SupabaseTenantRepository,
  SupabaseUserRepository,
  SupabaseAdminAuthAdapter,
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

  // 2. PRIVILEGED CLIENT: Bypasses RLS, used STRICTLY for Auth Admin actions
  const adminClient = createBaseSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Kept strictly on the server
  );
  const adminAuthAdapter = new SupabaseAdminAuthAdapter(adminClient);

  // 3. Assemble: The Use Case gets exactly the privileges it needs, where it needs them.
  return new OnboardTenantUseCase(tenantRepository, userRepository, adminAuthAdapter, eventBus);
}

export async function getRegisterGlobalIdentityUseCase(): Promise<RegisterGlobalIdentityUseCase> {
  const supabaseClient = await createSupabaseServerClient();
  const adapter = new SupabaseAuthAdapter(supabaseClient);
  return new RegisterGlobalIdentityUseCase(adapter);
}

import { SupabaseClient } from '@supabase/supabase-js';
import { AuthPort } from '@/iam/application/ports/out/auth.port';
import { InvalidCredentialsException } from '@/iam/domain/exceptions/invalid-credentials.exception';
import { AuthGatewayException } from '@/iam/application/exceptions/auth-gateway.exception';
import { TenantNotConfiguredException } from '@/iam/application/exceptions/tenant-not-configured.exception';

export class SupabaseAuthAdapter implements AuthPort {
  constructor(private readonly supabase: SupabaseClient) {}

  async signInWithEmail(
    email: string,
    password: string,
  ): Promise<{ userId: string; tenantId: string }> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (
        error.status === 400 &&
        error.message.toLowerCase().includes('invalid login credentials')
      ) {
        throw new InvalidCredentialsException();
      }
      throw new AuthGatewayException(`Supabase auth failed: ${error.message}`, error);
    }

    if (!data.user || !data.session) {
      throw new AuthGatewayException('No user data returned from Supabase');
    }

    // Assuming tenantId is stored in user_metadata or app_metadata
    const tenantId = data.user.app_metadata?.app_tenant_id || null;

    if (!tenantId) {
      throw new TenantNotConfiguredException();
    }

    return {
      userId: data.user.id,
      tenantId: tenantId,
    };
  }

  async getOAuthSignInUrl(provider: string, redirectTo: string): Promise<string> {
    const { data, error } = await this.supabase.auth.signInWithOAuth({
      provider: provider as any,
      options: {
        redirectTo,
      },
    });

    if (error) {
      throw new AuthGatewayException(`Supabase OAuth failed: ${error.message}`, error);
    }

    if (!data.url) {
      throw new AuthGatewayException('No OAuth URL returned from Supabase');
    }

    return data.url;
  }
  async exchangeOAuthCode(code: string): Promise<void> {
    const { error } = await this.supabase.auth.exchangeCodeForSession(code);

    if (error) {
      throw new AuthGatewayException(
        `Supabase OAuth code exchange failed: ${error.message}`,
        error,
      );
    }
  }

  async signUpWithEmail(email: string, password: string): Promise<string> {
    const { data, error } = await this.supabase.auth.signUp({ email, password });
    if (error) throw new AuthGatewayException(`Signup failed: ${error.message}`, error);
    if (!data.user) throw new AuthGatewayException('Signup failed', 'No user returned');
    return data.user.id;
  }
}

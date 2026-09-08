import { SupabaseClient } from '@supabase/supabase-js';
import { AuthPort } from '@/iam/application/ports/out/auth.port';
import { InvalidCredentialsException } from '@/iam/domain/exceptions/invalid-credentials.exception';
import { AuthGatewayException } from '@/iam/domain/exceptions/auth-gateway.exception';

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
    const tenantId = data.user.app_metadata?.tenant_id || data.user.user_metadata?.tenant_id;

    if (!tenantId) {
      throw new AuthGatewayException('User does not have a tenantId associated');
    }

    return {
      userId: data.user.id,
      tenantId: tenantId as string,
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
}

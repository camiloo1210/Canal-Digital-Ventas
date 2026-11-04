import { SupabaseClient } from '@supabase/supabase-js';
import { AdminAuthPort } from '@/iam/application/ports/out/admin-auth.port';
import { EmailAlreadyRegisteredException } from '@/iam/application/exceptions/email-already-registered.exception';
import { AdminAuthException } from '@/iam/application/exceptions/admin-auth.exception';

export class SupabaseAdminAuthAdapter implements AdminAuthPort {
  // This client MUST be instantiated with the service_role key
  constructor(private readonly adminClient: SupabaseClient) {}

  async setTenantClaim(userId: string, tenantId: string): Promise<void> {
    const { error } = await this.adminClient.auth.admin.updateUserById(userId, {
      app_metadata: { app_tenant_id: tenantId },
    });

    if (error) {
      throw new AdminAuthException(`Failed to assign tenant claim: ${error.message}`, error);
    }
  }

  /**
   * auth.admin.createUser with email_confirm: true marks the address as verified and sends no
   * email (unlike inviteUserByEmail or a public signUp). app_metadata is writable only with the
   * service role key, so end users cannot forge the managed_by_tenant marker.
   */
  async createConfirmedUser(
    email: string,
    password: string,
    managedByTenantId: string,
  ): Promise<string> {
    const { data, error } = await this.adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { managed_by_tenant: managedByTenantId },
    });
    if (error) {
      if (error.code === 'email_exists' || error.code === 'user_already_exists') {
        throw new EmailAlreadyRegisteredException();
      }
      throw new AdminAuthException(`Failed to create user: ${error.message}`, error);
    }
    if (!data.user) throw new AdminAuthException('Failed to create user: no user returned');
    return data.user.id;
  }

  async deleteUser(userId: string): Promise<void> {
    const { error } = await this.adminClient.auth.admin.deleteUser(userId);
    if (error) throw new AdminAuthException(`Failed to delete user: ${error.message}`, error);
  }

  async setPassword(userId: string, password: string): Promise<void> {
    const { error } = await this.adminClient.auth.admin.updateUserById(userId, { password });
    // The vendor message is not forwarded verbatim in case it ever echoes the input.
    if (error) throw new AdminAuthException('Failed to update the password');
  }
}

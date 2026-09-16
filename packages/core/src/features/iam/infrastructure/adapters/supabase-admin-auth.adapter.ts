import { SupabaseClient } from '@supabase/supabase-js';
import { AdminAuthPort } from '@/iam/application/ports/out/admin-auth.port';
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
}

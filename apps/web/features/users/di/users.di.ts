import 'server-only';
import { sql } from '@/lib/postgres/server';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';
import { getAdminAuthPort } from '@/features/iam/di/iam.di';
import {
  AcceptInvitationUseCase,
  AssignMemberRoleUseCase,
  CreateInvitationUseCase,
  CreateStaffAccountUseCase,
  CreateTenantRoleUseCase,
  DeleteTenantRoleUseCase,
  GetInvitationPreviewUseCase,
  NodeCryptoTokenGenerator,
  PostgresBusinessAccountReadRepository,
  PostgresDemographicStatsReadRepository,
  PostgresInvitationAcceptanceAdapter,
  PostgresInvitationPreviewReadRepository,
  PostgresInvitationReadRepository,
  PostgresInvitationRepository,
  PostgresMemberDirectoryReadRepository,
  PostgresMemberPermissionsReadRepository,
  PostgresMembershipRepository,
  PostgresOrderTenantRepository,
  PostgresOwnProfileReadRepository,
  PostgresSignupDemographicsAdapter,
  PostgresTenantOwnershipAdapter,
  PostgresTenantRoleReadRepository,
  PostgresTenantRoleRepository,
  PostgresTransactionManagerAdapter,
  PostgresUserProfileRepository,
  RecordSignupDemographicsUseCase,
  RenameManagedAccountUseCase,
  ResetManagedAccountPasswordUseCase,
  PostgresSessionRevocationAdapter,
  RevokeInvitationUseCase,
  SetMemberActiveUseCase,
  UnlinkMemberUseCase,
  StaffEmailGenerator,
  SupabaseAuthAdapter,
  type TransactionContext,
  UpdateOwnProfileUseCase,
  UpdateTenantRoleUseCase,
  type BusinessAccountReadPort,
  type DemographicStatsReadPort,
  type InvitationReadPort,
  type MemberDirectoryReadPort,
  type MemberPermissionsReadPort,
  type OwnProfileReadPort,
  type TenantRoleReadPort,
} from '@canaldigital/packages/core';

export function getCreateTenantRoleUseCase(): CreateTenantRoleUseCase {
  return new CreateTenantRoleUseCase(
    new PostgresTenantRoleRepository(),
    new PostgresTenantOwnershipAdapter(),
    new PostgresTransactionManagerAdapter(sql),
  );
}

export function getUpdateTenantRoleUseCase(): UpdateTenantRoleUseCase {
  return new UpdateTenantRoleUseCase(
    new PostgresTenantRoleRepository(),
    new PostgresTenantOwnershipAdapter(),
    new PostgresTransactionManagerAdapter(sql),
  );
}

export function getDeleteTenantRoleUseCase(): DeleteTenantRoleUseCase {
  return new DeleteTenantRoleUseCase(
    new PostgresTenantRoleRepository(),
    new PostgresTenantOwnershipAdapter(),
    new PostgresTransactionManagerAdapter(sql),
  );
}

export function getCreateInvitationUseCase(): CreateInvitationUseCase {
  return new CreateInvitationUseCase(
    new PostgresInvitationRepository(),
    new PostgresTenantRoleRepository(),
    new PostgresTenantOwnershipAdapter(),
    new PostgresTransactionManagerAdapter(sql),
    new NodeCryptoTokenGenerator(),
  );
}

export function getRevokeInvitationUseCase(): RevokeInvitationUseCase {
  return new RevokeInvitationUseCase(
    new PostgresInvitationRepository(),
    new PostgresTenantOwnershipAdapter(),
    new PostgresTransactionManagerAdapter(sql),
  );
}

export function getAcceptInvitationUseCase(): AcceptInvitationUseCase {
  return new AcceptInvitationUseCase(
    new PostgresInvitationAcceptanceAdapter(),
    new NodeCryptoTokenGenerator(),
    new PostgresTransactionManagerAdapter(sql),
  );
}

export async function getCreateStaffAccountUseCase(): Promise<CreateStaffAccountUseCase> {
  return new CreateStaffAccountUseCase(
    new SupabaseAuthAdapter(await createSupabaseServerClient()),
    getAdminAuthPort(),
    new StaffEmailGenerator((length: number): Uint8Array =>
      crypto.getRandomValues(new Uint8Array(length)),
    ),
  );
}

export function getAssignMemberRoleUseCase(): AssignMemberRoleUseCase {
  return new AssignMemberRoleUseCase(
    new PostgresMembershipRepository(),
    new PostgresTenantRoleRepository(),
    new PostgresTenantOwnershipAdapter(),
    new PostgresTransactionManagerAdapter(sql),
  );
}

/**
 * The admin auth port is null when SUPABASE_SERVICE_ROLE_KEY is not configured: password resets and
 * generated-email accounts are then unavailable. Deactivation does not depend on it: a database
 * trigger on core.tenant_memberships cuts the auth access.
 */
export function isAdminAuthConfigured(): boolean {
  return getAdminAuthPort() !== null;
}

export function getUnlinkMemberUseCase(): UnlinkMemberUseCase {
  return new UnlinkMemberUseCase(
    new PostgresMembershipRepository(),
    new PostgresTenantOwnershipAdapter(),
    new PostgresTransactionManagerAdapter(sql),
  );
}

export function getSetMemberActiveUseCase(): SetMemberActiveUseCase {
  return new SetMemberActiveUseCase(
    new PostgresMembershipRepository(),
    new PostgresTenantOwnershipAdapter(),
    new PostgresTransactionManagerAdapter(sql),
  );
}

export function getResetManagedAccountPasswordUseCase(): ResetManagedAccountPasswordUseCase {
  return new ResetManagedAccountPasswordUseCase(
    new PostgresMembershipRepository(),
    new PostgresTenantOwnershipAdapter(),
    getAdminAuthPort(),
    new PostgresTransactionManagerAdapter(sql),
    new PostgresSessionRevocationAdapter(sql),
  );
}

export function getRenameManagedAccountUseCase(): RenameManagedAccountUseCase {
  return new RenameManagedAccountUseCase(
    new PostgresMembershipRepository(),
    new PostgresUserProfileRepository(),
    new PostgresTenantOwnershipAdapter(),
    new PostgresTransactionManagerAdapter(sql),
  );
}

export function getUpdateOwnProfileUseCase(): UpdateOwnProfileUseCase {
  return new UpdateOwnProfileUseCase(
    new PostgresUserProfileRepository(),
    new PostgresTransactionManagerAdapter(sql),
  );
}

export function getGetInvitationPreviewUseCase(): GetInvitationPreviewUseCase {
  return new GetInvitationPreviewUseCase(
    new PostgresInvitationPreviewReadRepository(sql),
    new NodeCryptoTokenGenerator(),
  );
}

export function getBusinessAccountReadRepository(): BusinessAccountReadPort {
  return new PostgresBusinessAccountReadRepository(sql);
}

export function getTenantRoleReadRepository(): TenantRoleReadPort {
  return new PostgresTenantRoleReadRepository(sql);
}

export function getInvitationReadRepository(): InvitationReadPort {
  return new PostgresInvitationReadRepository(sql);
}

export function getMemberDirectoryReadRepository(): MemberDirectoryReadPort {
  return new PostgresMemberDirectoryReadRepository(sql);
}

export function getDemographicStatsReadRepository(): DemographicStatsReadPort {
  return new PostgresDemographicStatsReadRepository(sql);
}

export function getMemberPermissionsReadRepository(): MemberPermissionsReadPort {
  return new PostgresMemberPermissionsReadRepository(sql);
}

export function getOwnProfileReadRepository(): OwnProfileReadPort {
  return new PostgresOwnProfileReadRepository(sql);
}

export function getRecordSignupDemographicsUseCase(): RecordSignupDemographicsUseCase {
  return new RecordSignupDemographicsUseCase(
    new PostgresSignupDemographicsAdapter(),
    new PostgresTransactionManagerAdapter(sql),
  );
}

export interface ActiveTenantIdBySlugResolver {
  resolve(slug: string, userId: string): Promise<string | null>;
}

export function getActiveTenantIdBySlugResolver(): ActiveTenantIdBySlugResolver {
  const tenants = new PostgresOrderTenantRepository();
  const transactions = new PostgresTransactionManagerAdapter(sql);
  return {
    resolve: async (slug: string, userId: string): Promise<string | null> =>
      transactions.runInTransaction(
        async (tx: TransactionContext): Promise<string | null> =>
          (await tenants.findActiveBySlug(slug, tx))?.id ?? null,
        { userId },
      ),
  };
}

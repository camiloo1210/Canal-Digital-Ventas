import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { resolveActionTenant } from '@/features/dashboard/server/resolve-action-tenant';

export interface UsersActor {
  userId: string;
  tenantId: string;
}

/**
 * The actor comes from the session. The business is the one the page named in the hidden
 * `tenantId` field, accepted only when the actor holds an ACTIVE membership in exactly that
 * tenant; a stale or forged value yields 'CONTEXT_CHANGED'. Role permissions are then enforced
 * by the Core use cases against that same tenant.
 */
export async function resolveUsersActor(
  data: FormData,
): Promise<UsersActor | 'CONTEXT_CHANGED' | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const tenant = await resolveActionTenant(data, user.id);
  return tenant ? { userId: user.id, tenantId: tenant.tenantId } : 'CONTEXT_CHANGED';
}

export async function resolveAuthenticatedUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export interface AuthenticatedIdentity {
  id: string;
  email: string;
  provider: string;
}

export async function resolveAuthenticatedIdentity(): Promise<AuthenticatedIdentity | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user
    ? {
        id: user.id,
        email: user.email ?? '',
        provider: String(user.app_metadata?.provider ?? ''),
      }
    : null;
}

/** Client-facing origin of this request, or null when the host is unknown. */
export async function requestPublicOrigin(): Promise<string | null> {
  const requestHeaders = await headers();
  const host = (requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host'))
    ?.split(',')[0]
    ?.trim();
  const protocol =
    requestHeaders.get('x-forwarded-proto')?.split(',')[0]?.trim() ??
    (host?.startsWith('localhost') ? 'http' : 'https');
  return host ? `${protocol}://${host}` : null;
}

/** Maps typed Core exceptions (by name) to translation keys under `Users.errors`. */
export function usersErrorKey(error: unknown): string {
  if (!(error instanceof Error)) return 'unexpected';
  switch (error.name) {
    case 'UserManagementForbiddenException':
      return 'forbidden';
    case 'TenantRoleNotFoundException':
      return 'roleNotFound';
    case 'TenantRoleNameTakenException':
      return 'roleNameTaken';
    case 'TenantRoleInUseException':
      return 'roleInUse';
    case 'InvitationNotFoundException':
      return 'invitationNotFound';
    case 'InvitationNotUsableException':
      return 'invitationNotUsable';
    case 'MemberNotFoundException':
      return 'memberNotFound';
    case 'MemberNotActiveException':
      return 'memberNotActive';
    case 'ProtectedMemberException':
      return 'protectedMember';
    case 'BusinessAccountBoundException':
      return 'businessAccountBound';
    case 'AlreadyMemberException':
      return 'alreadyMember';
    case 'InvalidTenantRoleException':
      return 'invalidRole';
    case 'InvalidInvitationException':
      return 'invalidInvitation';
    case 'StaffAccountConfirmationRequiredException':
      return 'confirmationRequired';
    case 'StaffEmailGenerationExhaustedException':
      return 'emailGenerationFailed';
    case 'InvalidDemographicBucketException':
      return 'invalidDemographic';
    case 'InvalidPersonNameException':
      return 'invalidName';
    case 'PersonalAccountProtectedException':
      return 'personalAccountProtected';
    case 'AdminAuthUnavailableException':
      return 'adminAuthUnavailable';
    case 'InvalidManagedPasswordException':
      return 'invalidPassword';
    default:
      return 'unexpected';
  }
}

import type { InvitationAccountMode } from '@/iam/domain/value-objects/invitation-account-mode.vo';

export interface TenantRoleReadModel {
  id: string;
  name: string;
  permissions: string[];
  memberCount: number;
  isSystem: boolean;
  createdAt: string;
}

export type InvitationViewStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'EXHAUSTED';

export interface InvitationReadModel {
  id: string;
  roleId: string;
  roleName: string;
  expiresAt: string;
  maxUses: number;
  useCount: number;
  revokedAt: string | null;
  status: InvitationViewStatus;
  accountMode: InvitationAccountMode;
  createdAt: string;
}

export interface MemberReadModel {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  baseRole: 'OWNER' | 'ADMIN' | 'MEMBER';
  roleId: string | null;
  roleName: string | null;
  status: 'active' | 'suspended' | 'invited';
  /** MANAGED: created by a generated-email invitation of this tenant. PERSONAL: the person's own account. */
  accountKind: 'MANAGED' | 'PERSONAL';
  accessStatus: 'ACTIVE' | 'SUSPENDED' | 'PENDING';
}

export interface DemographicBucketCount {
  value: string;
  count: number;
}

export interface DemographicDimensionStats {
  /** Only buckets with count >= DEMOGRAPHIC_MIN_BUCKET_SIZE. */
  buckets: DemographicBucketCount[];
  /** True when at least one bucket was hidden for privacy. */
  hasSuppressed: boolean;
}

export interface DemographicStatsReadModel {
  ageRange: DemographicDimensionStats;
  gender: DemographicDimensionStats;
  province: DemographicDimensionStats;
}

export interface InvitationPreviewReadModel {
  tenantId: string;
  tenantName: string;
  /** Used to derive generated login emails; never shown as an address. */
  tenantSlug: string;
  roleName: string;
  accountMode: InvitationAccountMode;
}

export interface MemberPermissionsReadModel {
  baseRole: 'OWNER' | 'ADMIN' | 'MEMBER';
  roleName: string | null;
  permissions: string[];
}

export interface OwnProfileReadModel {
  firstName: string;
  lastName: string;
  email: string;
  demographicConsent: boolean;
}

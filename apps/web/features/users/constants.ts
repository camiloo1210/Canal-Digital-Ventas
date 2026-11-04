/**
 * Permission areas shown in the role editor. Plain strings on purpose: this module is imported by
 * client components, which must not pull the Core barrel into the browser bundle. A unit test
 * keeps these values aligned with Core's UserPermission enum.
 * MANAGE_USERS and MANAGE_INVENTORY are intentionally absent: user management is owner-only and
 * inventory is edited through the catalog permission. Integrations (Kivi) are owner-only too.
 */
export interface PermissionGroup {
  key: 'orders' | 'catalog' | 'reports' | 'store';
  permissions: readonly string[];
}

export const PERMISSION_GROUPS: readonly PermissionGroup[] = [
  { key: 'orders', permissions: ['VIEW_ORDERS', 'MANAGE_ORDERS'] },
  { key: 'catalog', permissions: ['VIEW_CATALOG', 'MANAGE_CATALOG'] },
  { key: 'reports', permissions: ['VIEW_REPORTS'] },
  { key: 'store', permissions: ['MANAGE_STORE'] },
];

export const INVITATION_EXPIRY_OPTIONS: readonly number[] = [1, 3, 7, 14, 30];
export const INVITATION_DEFAULT_EXPIRY_DAYS = 7;
export const INVITATION_DEFAULT_MAX_USES = 1;
/** Mirrors Core's InvitationAccountMode (plain strings: this module reaches client bundles). */
export const INVITATION_ACCOUNT_MODE_OPTIONS: readonly string[] = [
  'GENERATED_EMAIL',
  'REAL_EMAIL',
  'GOOGLE',
];
export const INVITATION_DEFAULT_ACCOUNT_MODE = 'GENERATED_EMAIL';
export const INVITATION_MAX_USES = 100;

/** Option lists resolved on the server (from Core) and handed to client forms as props. */
export interface DemographicOptions {
  ageRanges: readonly string[];
  genders: readonly string[];
  provinces: readonly string[];
}

/** Cookie that carries an invitation (and consent choices) across the Google OAuth redirect. */
export const INVITE_GOOGLE_COOKIE = 'invite_google_pending';
export const INVITE_GOOGLE_COOKIE_MAX_AGE_SECONDS = 15 * 60;

/** Error codes the invitation page accepts from the query string (Users.invite.errors keys). */
export const INVITE_PAGE_ERROR_CODES: readonly string[] = [
  'invalidInput',
  'invitationNotUsable',
  'modeMismatch',
  'alreadyMember',
  'businessAccountBound',
  'rateLimited',
  'googleStartFailed',
  'googleFailed',
  'unexpected',
];

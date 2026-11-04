export interface UsersActionState {
  success: boolean;
  message: string | null;
  /** Bumps on every submission so the UI can react to repeated identical results. */
  revision: number;
}

/** `warning` reports a partial outcome (e.g. the business account could not be deactivated at the auth provider). */
export interface MemberActionState extends UsersActionState {
  warning?: string;
}

export interface RoleActionState extends UsersActionState {
  fieldErrors?: { name?: string; permissions?: string };
  /** Echoed back so a rejected form keeps what the owner typed. */
  values?: { name: string; permissions: string[] };
}

export interface InvitationActionState extends UsersActionState {
  fieldErrors?: { roleId?: string; expiresInDays?: string; maxUses?: string; accountMode?: string };
  /** Shown once, never persisted. */
  link?: string;
  expiresAt?: string;
  values?: { roleId: string; expiresInDays: string; maxUses: string; accountMode: string };
}

export interface ConsentValues {
  consent: boolean;
  ageRange: string;
  gender: string;
  province: string;
}

export interface AcceptInvitationActionState {
  success: boolean;
  message: string | null;
  fieldErrors?: Partial<
    Record<'email' | 'password' | 'confirmPassword' | 'firstName' | 'lastName', string>
  >;
  values?: ConsentValues & { email: string; firstName: string; lastName: string };
  /** Set after a GENERATED_EMAIL account exists: the login address the person must save. */
  generatedEmail?: string;
  revision: number;
}

export interface ProfileActionState extends UsersActionState {
  fieldErrors?: { firstName?: string; lastName?: string };
  values?: { firstName: string; lastName: string; consent: boolean };
}

export const INITIAL_USERS_STATE: UsersActionState = { success: false, message: null, revision: 0 };

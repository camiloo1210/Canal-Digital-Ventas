import { z } from 'zod';
import {
  AGE_RANGES,
  GENDERS,
  INVITATION_ACCOUNT_MODES,
  INVITATION_MAX_EXPIRY_DAYS,
  INVITATION_MAX_USES_LIMIT,
  PROVINCES,
  UserPermission,
} from '@canaldigital/packages/core';

/** Digits only, so exponent ("1e1"), hex ("0x5"), signed and decimal forms never reach Number(). */
function wholeNumberField(message: string, max: number): z.ZodType<number, string> {
  return z
    .string(message)
    .trim()
    .regex(/^\d+$/, message)
    .transform((value): number => Number(value))
    .pipe(z.number(message).int(message).min(1, message).max(max, message));
}

/** A person name: starts with a letter, no digits; letters, marks, spaces, apostrophes, dots, hyphens. */
function personNameField(message: string): z.ZodType<string, string> {
  return z
    .string(message)
    .trim()
    .min(1, message)
    .max(60, message)
    .regex(/^\p{L}[\p{L}\p{M}' .-]*$/u, message);
}

const permissionValues = Object.values(UserPermission) as [UserPermission, ...UserPermission[]];

export const roleFormSchema = z.object({
  roleId: z.string().uuid().optional(),
  name: z.string().trim().min(2, 'nameLength').max(40, 'nameLength'),
  permissions: z.array(z.enum(permissionValues)).min(1, 'permissionsRequired'),
});

export const deleteRoleSchema = z.object({ roleId: z.string().uuid() });

export const invitationAccountModeSchema = z.enum(INVITATION_ACCOUNT_MODES, 'accountModeInvalid');

export const createInvitationSchema = z.object({
  roleId: z.string().uuid('roleRequired'),
  accountMode: invitationAccountModeSchema.default('GENERATED_EMAIL'),
  expiresInDays: wholeNumberField('expiryInvalid', INVITATION_MAX_EXPIRY_DAYS),
  maxUses: wholeNumberField('maxUsesInvalid', INVITATION_MAX_USES_LIMIT),
});

export const revokeInvitationSchema = z.object({ invitationId: z.string().uuid() });

export const assignRoleSchema = z.object({
  memberUserId: z.string().uuid(),
  /** Empty string clears the member's role. */
  roleId: z.union([z.literal(''), z.string().uuid()]),
});

export const memberTargetSchema = z.object({ memberUserId: z.string().uuid() });

export const setMemberActiveSchema = memberTargetSchema.extend({
  active: z.enum(['true', 'false']).transform((value): boolean => value === 'true'),
});

export const resetMemberPasswordSchema = memberTargetSchema.extend({
  newPassword: z.string().min(8).max(200),
});

export const renameMemberSchema = memberTargetSchema.extend({
  firstName: personNameField('nameRequired'),
  lastName: personNameField('nameRequired'),
});

const optionalBucket = <T extends readonly [string, ...string[]]>(
  values: T,
): z.ZodType<T[number] | undefined> =>
  z.preprocess(
    (value: unknown): unknown => (value === '' || value === null ? undefined : value),
    z.enum(values).optional(),
  ) as z.ZodType<T[number] | undefined>;

export const consentSchema = z.object({
  consent: z.preprocess((value: unknown): boolean => value === 'on', z.boolean()),
  ageRange: optionalBucket(AGE_RANGES),
  gender: optionalBucket(GENDERS),
  province: optionalBucket(PROVINCES),
});

const nameField = personNameField('nameRequired');

const tokenField = z.string().trim().min(20).max(200);
const passwordField = z.string().min(8, 'passwordLength').max(200, 'passwordLength');

/** First, cheap parse: which invitation and which form variant the visitor claims to be using. */
export const invitationEntrySchema = z.object({
  token: tokenField,
  mode: invitationAccountModeSchema,
});

export const acceptGeneratedInvitationSchema = z
  .object({
    token: tokenField,
    password: passwordField,
    confirmPassword: z.string().max(200),
    firstName: nameField,
    lastName: nameField,
  })
  .refine((value): boolean => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'passwordMismatch',
  })
  .and(consentSchema);

export const acceptRealEmailInvitationSchema = z
  .object({
    token: tokenField,
    email: z.string().trim().email('emailInvalid'),
    password: passwordField,
    confirmPassword: z.string().optional(),
    firstName: nameField,
    lastName: nameField,
  })
  .and(consentSchema);

export const acceptAsCurrentUserSchema = z.object({ token: tokenField }).and(consentSchema);

/** Contents of the short-lived cookie that carries an invitation across the Google redirect. */
export const googleInviteCookieSchema = z
  .object({
    token: z.string().regex(/^[A-Za-z0-9_-]{20,200}$/),
    consent: z.boolean(),
    ageRange: z.enum(AGE_RANGES).optional(),
    gender: z.enum(GENDERS).optional(),
    province: z.enum(PROVINCES).optional(),
  })
  .strict()
  .refine(
    (value): boolean => value.consent || (!value.ageRange && !value.gender && !value.province),
    'Demographic buckets require consent',
  );

export const profileSchema = z.object({
  firstName: nameField,
  lastName: nameField,
  consent: z.preprocess((value: unknown): boolean => value === 'on', z.boolean()),
});

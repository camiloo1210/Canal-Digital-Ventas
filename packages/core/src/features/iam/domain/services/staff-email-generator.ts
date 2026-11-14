import { InvalidInvitationException } from '@/iam/domain/exceptions/invalid-invitation.exception';

/** RFC 2606 reserves .invalid: these addresses can never receive mail or belong to a real person. */
export const STAFF_EMAIL_DOMAIN_SUFFIX = '.staff.invalid';

const SLUG_MAX_LENGTH = 30;
const FALLBACK_SLUG = 'staff';
const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** ASCII a-z0-9 words joined by dots; accents stripped; at most 30 characters. */
export function slugifyPersonName(firstName: string, lastName: string): string {
  const slug = `${firstName} ${lastName}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/\.+$/g, '');
  return slug || FALLBACK_SLUG;
}

export interface StaffEmailInput {
  firstName: string;
  lastName: string;
  tenantSlug: string;
}

/** Creates deterministic candidate addresses; the auth provider enforces uniqueness. */
export class StaffEmailGenerator {
  public generate(input: StaffEmailInput, attempt: number = 0): string {
    if (!DNS_LABEL.test(input.tenantSlug)) {
      throw new InvalidInvitationException('Tenant slug cannot be used as an email domain label');
    }
    if (!Number.isSafeInteger(attempt) || attempt < 0) {
      throw new InvalidInvitationException('Invalid staff account attempt');
    }
    const slug = slugifyPersonName(input.firstName, input.lastName);
    return `${slug}${attempt ? attempt + 1 : ''}@${input.tenantSlug}${STAFF_EMAIL_DOMAIN_SUFFIX}`;
  }
}

/** Public login identifier for generated addresses, retaining legacy local parts. */
export function staffLoginIdentifier(email: string): string {
  return email.toLowerCase().endsWith(STAFF_EMAIL_DOMAIN_SUFFIX)
    ? email.slice(0, -STAFF_EMAIL_DOMAIN_SUFFIX.length)
    : email;
}

/** Expand only the unambiguous single-label staff identifier; real email addresses pass through. */
export function resolveStaffLoginIdentifier(identifier: string): string {
  const value = identifier.trim();
  return /^[a-z0-9]+(?:[.-][a-z0-9]+)*@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(value)
    ? `${value}${STAFF_EMAIL_DOMAIN_SUFFIX}`
    : value;
}

/** True for an address this generator could have produced for that tenant. */
export function isGeneratedStaffEmailOf(email: string, tenantSlug: string): boolean {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf('@');
  if (at < 1) return false;
  return normalized.slice(at + 1) === `${tenantSlug.toLowerCase()}${STAFF_EMAIL_DOMAIN_SUFFIX}`;
}

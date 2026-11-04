import { InvalidInvitationException } from '@/iam/domain/exceptions/invalid-invitation.exception';

/** RFC 2606 reserves .invalid: these addresses can never receive mail or belong to a real person. */
export const STAFF_EMAIL_DOMAIN_SUFFIX = '.staff.invalid';

const BASE32_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';
const SUFFIX_LENGTH = 6;
const SLUG_MAX_LENGTH = 30;
const FALLBACK_SLUG = 'staff';
const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** ASCII a-z0-9 words joined by single dashes; accents stripped; at most 30 characters. */
export function slugifyPersonName(firstName: string, lastName: string): string {
  const slug = `${firstName} ${lastName}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, '');
  return slug || FALLBACK_SLUG;
}

export interface StaffEmailInput {
  firstName: string;
  lastName: string;
  tenantSlug: string;
}

/**
 * Pure domain service. Randomness is injected so callers (and tests) control it; 256 mod 32 = 0,
 * so masking each byte to five bits is unbiased.
 */
export class StaffEmailGenerator {
  public constructor(private readonly randomBytes: (length: number) => Uint8Array) {}

  public generate(input: StaffEmailInput): string {
    if (!DNS_LABEL.test(input.tenantSlug)) {
      throw new InvalidInvitationException('Tenant slug cannot be used as an email domain label');
    }
    const bytes = this.randomBytes(SUFFIX_LENGTH);
    if (bytes.length < SUFFIX_LENGTH) {
      throw new InvalidInvitationException('Random source returned too few bytes');
    }
    let suffix = '';
    for (let index = 0; index < SUFFIX_LENGTH; index += 1) {
      suffix += BASE32_ALPHABET[bytes[index] & 31];
    }
    const slug = slugifyPersonName(input.firstName, input.lastName);
    return `${slug}.${suffix}@${input.tenantSlug}${STAFF_EMAIL_DOMAIN_SUFFIX}`;
  }
}

/** True for an address this generator could have produced for that tenant. */
export function isGeneratedStaffEmailOf(email: string, tenantSlug: string): boolean {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf('@');
  if (at < 1) return false;
  return normalized.slice(at + 1) === `${tenantSlug.toLowerCase()}${STAFF_EMAIL_DOMAIN_SUFFIX}`;
}

import { googleInviteCookieSchema } from '@/features/users/schemas/users.schema';

const MAX_COOKIE_LENGTH = 1024;

export interface GoogleInviteCookie {
  token: string;
  consent: boolean;
  ageRange?: string;
  gender?: string;
  province?: string;
}

/** Cookie contents are attacker-controlled input: parse strictly and discard anything unexpected. */
export function parseGoogleInviteCookie(raw: string | undefined): GoogleInviteCookie | null {
  if (!raw || raw.length > MAX_COOKIE_LENGTH) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = googleInviteCookieSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

export function serializeGoogleInviteCookie(value: GoogleInviteCookie): string {
  return JSON.stringify(value);
}

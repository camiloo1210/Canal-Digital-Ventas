const LOCALES = ['es', 'en'] as const;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ALPHA_2 = /^[A-Z]{2}$/;

interface CountryLookup {
  /** Region codes the runtime knows a display name for. */
  readonly codes: ReadonlySet<string>;
  /** Folded display name → code, or null when a name maps to several codes. */
  readonly names: ReadonlyMap<string, string | null>;
}

let lookup: CountryLookup | null = null;

/** Lowercase, accent-free, single-spaced form used to compare country names. */
function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function buildLookup(): CountryLookup {
  const codes = new Set<string>();
  const names = new Map<string, string | null>();
  for (const locale of LOCALES) {
    const display = new Intl.DisplayNames([locale], { type: 'region', fallback: 'none' });
    for (const first of LETTERS) {
      for (const second of LETTERS) {
        const code = `${first}${second}`;
        let name: string | undefined;
        try {
          name = display.of(code);
        } catch {
          name = undefined;
        }
        if (!name || name === code) continue;
        codes.add(code);
        const key = fold(name);
        const existing = names.get(key);
        if (existing === undefined) names.set(key, code);
        else if (existing !== code) names.set(key, null);
      }
    }
  }
  return { codes, names };
}

/**
 * Normalizes a free-text country (ISO alpha-2 code or Spanish/English country name) to an
 * uppercase ISO 3166-1 alpha-2 code. Returns null when unknown or ambiguous.
 */
export function normalizeCountryCode(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  lookup ??= buildLookup();
  const upper = trimmed.toUpperCase();
  if (ALPHA_2.test(upper)) return lookup.codes.has(upper) ? upper : null;
  return lookup.names.get(fold(trimmed)) ?? null;
}

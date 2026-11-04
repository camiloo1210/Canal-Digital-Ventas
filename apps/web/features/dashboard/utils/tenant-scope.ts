/** Name of the hidden form field that carries the business a mutation is meant for. */
export const TENANT_FIELD = 'tenantId';
/** Search parameter that carries the business a dashboard page renders. */
export const TENANT_PARAM = 'tenant';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TenantSearchParams = Record<string, string | string[] | undefined>;

export function isTenantId(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

/** First `tenant` search-param value as a trimmed string, or null when absent. */
export function tenantParam(value: string | readonly string[] | undefined | null): string | null {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === 'string' && first.trim() !== '' ? first.trim() : null;
}

/** Appends `?tenant=<id>` (or `&tenant=`) to an internal dashboard href. */
export function withTenant(href: string, tenantId: string | null | undefined): string {
  if (!tenantId) return href;
  const hashAt = href.indexOf('#');
  const base = hashAt === -1 ? href : href.slice(0, hashAt);
  const hash = hashAt === -1 ? '' : href.slice(hashAt);
  const cleaned = base
    .replace(new RegExp('([?&])' + TENANT_PARAM + '=[^&]*&?'), '$1')
    .replace(/[?&]$/, '');
  return cleaned + (cleaned.includes('?') ? '&' : '?') + TENANT_PARAM + '=' + tenantId + hash;
}

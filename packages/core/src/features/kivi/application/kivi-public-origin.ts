import { isPrivateAddress } from '@/kivi/infrastructure/private-address';

/** Returns the origin only when it is a bare public https origin; otherwise null (no DNS here). */
export function publicHttpsOrigin(raw: string | null): string | null {
  if (raw === null) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    return null;
  }
  if (raw !== url.origin && raw !== `${url.origin}/`) return null;
  const host = url.hostname.toLowerCase();
  const isIp = /^[0-9.]+$/.test(host) || host.startsWith('[');
  if (isIp) return isPrivateAddress(host) ? null : url.origin;
  if (!host.includes('.') || host.endsWith('.')) return null;
  if (/(^|\.)(localhost|local|internal|localdomain|lan|home\.arpa)$/.test(host)) return null;
  return url.origin;
}

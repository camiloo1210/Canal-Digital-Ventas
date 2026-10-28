import { InvalidKiviConnectionException } from '@/kivi/domain/exceptions/invalid-kivi-connection.exception';

export interface KiviBaseUrlOptions {
  /** Permits loopback hosts over http/https. Never enable outside local development. */
  allowLocalDevelopment?: boolean;
}

const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.localdomain', '.lan', '.home'];
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * Validated origin of a Kivi deployment (SSRF guard, first layer). Only public DNS names
 * over https are accepted: no credentials, path, query, fragment or IP literals.
 */
export class KiviBaseUrl {
  private constructor(private readonly value: string) {}

  public static from(raw: string, options: KiviBaseUrlOptions = {}): KiviBaseUrl {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new InvalidKiviConnectionException('Kivi base URL is not a valid URL.');
    }
    const host = url.hostname.toLowerCase();
    const local = options.allowLocalDevelopment === true && LOOPBACK_HOSTS.has(host);
    if (!local) {
      if (url.protocol !== 'https:') {
        throw new InvalidKiviConnectionException('Kivi base URL must use https.');
      }
      KiviBaseUrl.assertPublicDnsName(host);
    } else if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new InvalidKiviConnectionException('Kivi base URL must use http or https.');
    }
    if (url.username || url.password) {
      throw new InvalidKiviConnectionException('Kivi base URL must not embed credentials.');
    }
    if ((url.pathname !== '/' && url.pathname !== '') || url.search || url.hash) {
      throw new InvalidKiviConnectionException('Kivi base URL must be an origin only.');
    }
    return new KiviBaseUrl(url.origin);
  }

  private static assertPublicDnsName(host: string): void {
    if (host.startsWith('[') || IPV4.test(host)) {
      throw new InvalidKiviConnectionException('Kivi base URL must use a DNS name, not an IP.');
    }
    const labels = host.split('.');
    const blocked =
      labels.length < 2 ||
      host === 'localhost' ||
      /^\d+$/.test(labels[labels.length - 1]) ||
      BLOCKED_SUFFIXES.some((suffix: string): boolean => host.endsWith(suffix)) ||
      host === 'metadata.google.internal';
    if (blocked) {
      throw new InvalidKiviConnectionException('Kivi base URL host is not a public DNS name.');
    }
  }

  public getValue(): string {
    return this.value;
  }

  public toString(): string {
    return this.value;
  }
}

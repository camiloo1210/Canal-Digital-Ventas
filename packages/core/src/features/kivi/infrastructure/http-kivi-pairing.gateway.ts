import { lookup } from 'node:dns/promises';
import type { KiviTarget } from '@/kivi/application/ports/out/kivi-catalog-gateway.port';
import type {
  KiviPairingExchangeRequest,
  KiviPairingExchangeResult,
  KiviPairingGatewayPort,
} from '@/kivi/application/ports/out/kivi-pairing-gateway.port';
import {
  KiviPairingException,
  type KiviPairingFailure,
} from '@/kivi/application/exceptions/kivi-pairing.exception';
import { KiviBaseUrl, type KiviBaseUrlOptions } from '@/kivi/domain/value-objects/kivi-base-url.vo';
import { InvalidKiviConnectionException } from '@/kivi/domain/exceptions/invalid-kivi-connection.exception';
import { isPrivateAddress } from '@/kivi/infrastructure/private-address';

const DEFAULT_TIMEOUT_MS = 10_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^kc_[A-Za-z0-9_-]{43}$/;

export interface HttpKiviPairingGatewayOptions {
  /** Platform-wide Kivi origin (operator configuration; tenants never supply it). */
  baseUrl: KiviBaseUrl;
  fetch?: typeof fetch;
  timeoutMs?: number;
  urlOptions?: KiviBaseUrlOptions;
  resolveAddresses?: (host: string) => Promise<string[]>;
}

async function defaultResolve(host: string): Promise<string[]> {
  const results = await lookup(host, { all: true });
  return results.map((r): string => r.address);
}

/**
 * Kivi pairing endpoints, server-to-server only. Finite timeout, redirects rejected, no
 * cookies, no retries. Errors carry a classification only: never the code, token, URL or body.
 */
export class HttpKiviPairingGateway implements KiviPairingGatewayPort {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly urlOptions: KiviBaseUrlOptions;
  private readonly resolveAddresses: (host: string) => Promise<string[]>;
  private readonly baseUrl: KiviBaseUrl;

  public constructor(options: HttpKiviPairingGatewayOptions) {
    this.baseUrl = options.baseUrl;
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.urlOptions = options.urlOptions ?? {};
    this.resolveAddresses = options.resolveAddresses ?? defaultResolve;
  }

  public async exchange(request: KiviPairingExchangeRequest): Promise<KiviPairingExchangeResult> {
    const response = await this.send(this.baseUrl.getValue(), '/pairing/exchange', {
      body: {
        code: request.code,
        external_tenant_id: request.externalTenantId,
        name: request.name,
      },
    });
    let record: Record<string, unknown>;
    try {
      record = (await response.json()) as Record<string, unknown>;
    } catch {
      throw new KiviPairingException('unavailable');
    }
    const connectionId = record?.connection_id;
    const token = record?.token;
    if (
      typeof connectionId !== 'string' ||
      !UUID.test(connectionId) ||
      typeof token !== 'string' ||
      !TOKEN.test(token)
    ) {
      throw new KiviPairingException('unavailable');
    }
    return {
      connectionId,
      token,
      scopes: Array.isArray(record.scopes)
        ? record.scopes.filter((s: unknown): s is string => typeof s === 'string')
        : [],
      expiresAt: typeof record.expires_at === 'string' ? record.expires_at : null,
    };
  }

  public async revokeSelf(target: KiviTarget): Promise<void> {
    if (!UUID.test(target.connectionId)) throw new KiviPairingException('unavailable');
    await this.send(target.baseUrl, `/${target.connectionId}/revoke-self`, {
      bearer: target.token,
    });
  }

  private async send(
    rawBase: string,
    path: string,
    options: { body?: unknown; bearer?: string },
  ): Promise<Response> {
    let origin: string;
    try {
      origin = KiviBaseUrl.from(rawBase, this.urlOptions).getValue();
    } catch (error: unknown) {
      if (error instanceof InvalidKiviConnectionException) {
        throw new KiviPairingException('unavailable');
      }
      throw error;
    }
    await this.assertPublicHost(origin);

    const abort = new AbortController();
    const timer = setTimeout((): void => abort.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${origin}/api/v1/connections${path}`, {
        method: 'POST',
        redirect: 'error',
        credentials: 'omit',
        cache: 'no-store',
        signal: abort.signal,
        headers: {
          Accept: 'application/json',
          ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(options.bearer === undefined ? {} : { Authorization: `Bearer ${options.bearer}` }),
        },
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });
      if (!response.ok) throw new KiviPairingException(this.classify(response.status));
      return response;
    } catch (error: unknown) {
      if (error instanceof KiviPairingException) throw error;
      // Network failure, abort (timeout) or blocked redirect.
      throw new KiviPairingException('unavailable');
    } finally {
      clearTimeout(timer);
    }
  }

  private classify(status: number): KiviPairingFailure {
    if (status === 400 || status === 401 || status === 403) return 'invalid_or_expired_code';
    if (status === 429) return 'rate_limited';
    return 'unavailable';
  }

  private async assertPublicHost(origin: string): Promise<void> {
    if (this.urlOptions.allowLocalDevelopment === true) return;
    let addresses: string[];
    try {
      addresses = await this.resolveAddresses(new URL(origin).hostname);
    } catch {
      throw new KiviPairingException('unavailable');
    }
    if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
      throw new KiviPairingException('unavailable');
    }
  }
}

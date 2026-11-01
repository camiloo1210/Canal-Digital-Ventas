import { lookup } from 'node:dns/promises';
import type {
  KiviCatalogGatewayPort,
  KiviProductIdentity,
  KiviProductPayload,
  KiviTarget,
} from '@/kivi/application/ports/out/kivi-catalog-gateway.port';
import {
  KiviGatewayException,
  type KiviGatewayFailure,
} from '@/kivi/application/exceptions/kivi-gateway.exception';
import { KiviBaseUrl, type KiviBaseUrlOptions } from '@/kivi/domain/value-objects/kivi-base-url.vo';
import { InvalidKiviConnectionException } from '@/kivi/domain/exceptions/invalid-kivi-connection.exception';
import { isPrivateAddress } from '@/kivi/infrastructure/private-address';

const EXTERNAL_ID = /^[a-zA-Z0-9_.:@-]{1,200}$/;
const MAX_RETRY_AFTER_MS = 120_000;
const DEFAULT_TIMEOUT_MS = 10_000;
const NOT_FOUND = Symbol('Kivi identity not found');

export interface HttpKiviCatalogGatewayOptions {
  fetch?: typeof fetch;
  timeoutMs?: number;
  urlOptions?: KiviBaseUrlOptions;
  /** Resolves a hostname to its addresses; overridable for tests. */
  resolveAddresses?: (host: string) => Promise<string[]>;
}

async function defaultResolve(host: string): Promise<string[]> {
  const results = await lookup(host, { all: true });
  return results.map((r): string => r.address);
}

/**
 * Kivi application API (docs/application-connections.md), server-to-server only.
 * Finite timeout, redirects rejected, no cookies, never retries (callers own the policy), and
 * errors expose only status/classification: never URLs, headers, bodies or credentials.
 */
export class HttpKiviCatalogGateway implements KiviCatalogGatewayPort {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly urlOptions: KiviBaseUrlOptions;
  private readonly resolveAddresses: (host: string) => Promise<string[]>;

  public constructor(options: HttpKiviCatalogGatewayOptions = {}) {
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.urlOptions = options.urlOptions ?? {};
    this.resolveAddresses = options.resolveAddresses ?? defaultResolve;
  }

  public async putProduct(
    target: KiviTarget,
    externalId: string,
    payload: KiviProductPayload,
  ): Promise<void> {
    await this.request(target, 'PUT', `/catalog/products/${this.segment(externalId)}`, payload);
  }

  public async deleteProduct(
    target: KiviTarget,
    externalId: string,
    version: number,
  ): Promise<void> {
    if (!Number.isSafeInteger(version) || version < 1) throw this.fail('rejected', 0);
    await this.request(
      target,
      'DELETE',
      `/catalog/products/${this.segment(externalId)}?version=${version}`,
    );
  }

  public async getIdentity(
    target: KiviTarget,
    externalId: string,
  ): Promise<KiviProductIdentity | null> {
    const body = await this.request(
      target,
      'GET',
      `/catalog/products/${this.segment(externalId)}`,
      undefined,
      true,
    );
    if (body === NOT_FOUND) return null;
    if (
      typeof body !== 'object' ||
      body === null ||
      Array.isArray(body) ||
      !('external_id' in body) ||
      body.external_id !== externalId ||
      !('version' in body) ||
      typeof body.version !== 'number' ||
      !Number.isSafeInteger(body.version) ||
      body.version < 1 ||
      !('deleted' in body) ||
      typeof body.deleted !== 'boolean' ||
      !('product_id' in body) ||
      (body.product_id !== null && (typeof body.product_id !== 'string' || !body.product_id.trim()))
    ) {
      throw this.fail('transient', 200);
    }
    return {
      externalId,
      kiviProductId: body.product_id,
      version: body.version,
      deleted: body.deleted,
    };
  }

  public async listKiviProductIds(target: KiviTarget): Promise<string[]> {
    const body = await this.request(target, 'GET', '/catalog/products');
    if (!Array.isArray(body)) throw this.fail('transient', 200);
    return body.map((item: unknown): string => {
      if (
        typeof item !== 'object' ||
        item === null ||
        !('id' in item) ||
        typeof item.id !== 'string' ||
        !item.id.trim()
      ) {
        throw this.fail('transient', 200);
      }
      return item.id;
    });
  }

  private segment(externalId: string): string {
    if (!EXTERNAL_ID.test(externalId) || externalId === '.' || externalId === '..') {
      throw this.fail('rejected', 0);
    }
    return encodeURIComponent(externalId);
  }

  private fail(
    failure: KiviGatewayFailure,
    status: number,
    retryAfterMs: number | null = null,
  ): KiviGatewayException {
    return new KiviGatewayException(failure, status, retryAfterMs);
  }

  protected async request(
    target: KiviTarget,
    method: 'GET' | 'PUT' | 'DELETE' | 'POST',
    path: string,
    body?: unknown,
    notFoundIsNull: boolean = false,
  ): Promise<unknown> {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target.connectionId)
    )
      throw this.fail('rejected', 0);
    let origin: string;
    try {
      origin = KiviBaseUrl.from(target.baseUrl, this.urlOptions).getValue();
    } catch (error: unknown) {
      if (error instanceof InvalidKiviConnectionException) throw this.fail('rejected', 0);
      throw error;
    }
    await this.assertPublicHost(origin);

    const abort = new AbortController();
    const timer = setTimeout((): void => abort.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(
        `${origin}/api/v1/connections/${target.connectionId}${path}`,
        {
          method,
          redirect: 'error',
          credentials: 'omit',
          cache: 'no-store',
          signal: abort.signal,
          headers: {
            Authorization: `Bearer ${target.token}`,
            Accept: 'application/json',
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        },
      );
      if (response.status === 404 && notFoundIsNull) return NOT_FOUND;
      if (!response.ok) throw this.classify(response);
      if (response.status === 204) return undefined;
      return await response.json();
    } catch (error: unknown) {
      if (error instanceof KiviGatewayException) throw error;
      // Network failure, abort (timeout), blocked redirect or malformed body.
      throw this.fail('transient', 0);
    } finally {
      clearTimeout(timer);
    }
  }

  private classify(response: Response): KiviGatewayException {
    const status = response.status;
    if (status === 409) return this.fail('conflict', status);
    if (status === 429) {
      const header = response.headers.get('Retry-After');
      const seconds = header !== null && /^\d{1,7}$/.test(header) ? Number(header) : null;
      const ms = seconds === null ? null : Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
      return this.fail('rate_limited', status, ms);
    }
    if (status === 408 || status >= 500) return this.fail('transient', status);
    return this.fail('rejected', status);
  }

  /** Blocks DNS names that resolve to internal ranges. Residual rebinding window is documented. */
  private async assertPublicHost(origin: string): Promise<void> {
    if (this.urlOptions.allowLocalDevelopment === true) return;
    let addresses: string[];
    try {
      addresses = await this.resolveAddresses(new URL(origin).hostname);
    } catch {
      throw this.fail('transient', 0);
    }
    if (addresses.length === 0 || addresses.some(isPrivateAddress)) throw this.fail('rejected', 0);
  }
}

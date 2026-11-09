import { TrackingAuthorizationException } from '@/shipment-tracking/application/tracking-authorization.exception';
import { InfrastructureException } from '@/shared/application/exceptions/infrastructure.exception';

export class FedexTrackingException extends InfrastructureException {
  public constructor(message: string) {
    super(message);
    this.name = 'FedexTrackingException';
  }
}
export class FedexTransientException extends FedexTrackingException {
  public readonly retryable = true;
  public constructor(public readonly retryAfterSeconds: number | null = null) {
    super('FedEx service temporarily unavailable');
  }
}
export interface FedexCredentialResolver {
  resolve(ref: string): Promise<{ readonly clientId: string; readonly clientSecret: string }>;
}
export class FedexAuthAdapter {
  private readonly tokens = new Map<string, { token: string; expiresAt: number }>();
  public constructor(
    private readonly resolver: FedexCredentialResolver,
    private readonly fetcher: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {}
  public invalidate(ref: string): void {
    this.tokens.delete(ref);
  }
  public async getToken(ref: string): Promise<string> {
    const cached = this.tokens.get(ref);
    if (cached && cached.expiresAt > this.now()) return cached.token;
    try {
      const credentials = await this.resolver.resolve(ref);
      if (!credentials.clientId || !credentials.clientSecret)
        throw new TrackingAuthorizationException();
      const response = await this.fetcher('https://apis-sandbox.fedex.com/oauth/token', {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
        }),
      });
      if (response.status === 401 || response.status === 403)
        throw new TrackingAuthorizationException();
      if (!response.ok) {
        const retry = response.headers.get('retry-after');
        const seconds =
          retry && /^\d+$/.test(retry)
            ? Number(retry)
            : retry && Number.isFinite(Date.parse(retry))
              ? Math.max(0, Math.ceil((Date.parse(retry) - this.now()) / 1000))
              : null;
        throw new FedexTransientException(
          seconds !== null && Number.isSafeInteger(seconds) ? seconds : null,
        );
      }
      if (!response.body) throw new FedexTransientException();
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let length = 0;
      try {
        for (;;) {
          const part = await reader.read();
          if (part.done) break;
          length += part.value.length;
          if (length > 1048576) {
            await reader.cancel();
            throw new TrackingAuthorizationException();
          }
          chunks.push(part.value);
        }
      } finally {
        reader.releaseLock();
      }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      const data: unknown = JSON.parse(new TextDecoder().decode(bytes));
      if (
        typeof data !== 'object' ||
        data === null ||
        !('access_token' in data) ||
        typeof data.access_token !== 'string' ||
        !data.access_token ||
        !('expires_in' in data) ||
        typeof data.expires_in !== 'number' ||
        !Number.isFinite(data.expires_in) ||
        data.expires_in <= 0
      )
        throw new TrackingAuthorizationException();
      this.tokens.set(ref, {
        token: data.access_token,
        expiresAt: this.now() + Math.max(0, data.expires_in - 60) * 1000,
      });
      return data.access_token;
    } catch (error: unknown) {
      if (
        error instanceof TrackingAuthorizationException ||
        error instanceof FedexTransientException
      )
        throw error;
      throw new FedexTransientException();
    }
  }
}

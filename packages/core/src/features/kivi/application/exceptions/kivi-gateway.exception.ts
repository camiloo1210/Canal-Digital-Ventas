import { InfrastructureException } from '@/shared/application/exceptions/infrastructure.exception';

export type KiviGatewayFailure = 'conflict' | 'rate_limited' | 'transient' | 'rejected';

/** Never carries URLs, headers, bodies or credentials. */
export class KiviGatewayException extends InfrastructureException {
  public constructor(
    public readonly failure: KiviGatewayFailure,
    public readonly status: number,
    public readonly retryAfterMs: number | null = null,
  ) {
    super(`Kivi request failed (${failure}; status ${status})`);
    this.name = 'KiviGatewayException';
  }
}

import { InfrastructureException } from '@/shared/application/exceptions/infrastructure.exception';

export type KiviPairingFailure = 'invalid_or_expired_code' | 'rate_limited' | 'unavailable';

/** Classification only: never carries the pairing code, token, URL or response body. */
export class KiviPairingException extends InfrastructureException {
  public constructor(public readonly failure: KiviPairingFailure) {
    super(`Kivi pairing failed (${failure})`);
    this.name = 'KiviPairingException';
  }
}

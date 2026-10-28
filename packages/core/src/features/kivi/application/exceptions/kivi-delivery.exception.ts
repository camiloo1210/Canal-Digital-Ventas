import { ApplicationException } from '@/shared/application/exceptions/application.exception';

/** Delivery did not complete; the outbox event must be retried. */
export class KiviDeliveryException extends ApplicationException {
  public constructor(
    reason: string,
    public readonly retryAfterMs: number | null = null,
  ) {
    super(`Kivi delivery failed: ${reason}`);
  }
}

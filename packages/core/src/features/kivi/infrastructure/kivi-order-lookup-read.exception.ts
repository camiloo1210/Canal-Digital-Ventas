import { InfrastructureException } from '@/shared/application/exceptions/infrastructure.exception';

/** Never carries phone numbers, order numbers or SQL parameters. */
export class KiviOrderLookupReadException extends InfrastructureException {
  public constructor(public readonly originalError?: unknown) {
    super('Kivi order lookup read failed');
    this.name = 'KiviOrderLookupReadException';
  }
}

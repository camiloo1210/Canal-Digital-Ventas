import { InfrastructureException } from '@/shared/application/exceptions/infrastructure.exception';

/** Never carries the search text or SQL parameters. */
export class KiviProductLookupReadException extends InfrastructureException {
  public constructor(public readonly originalError?: unknown) {
    super('Kivi product lookup read failed');
    this.name = 'KiviProductLookupReadException';
  }
}

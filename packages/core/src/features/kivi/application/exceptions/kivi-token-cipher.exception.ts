import { InfrastructureException } from '@/shared/application/exceptions/infrastructure.exception';

export class KiviTokenCipherException extends InfrastructureException {
  public constructor() {
    super('The Kivi credential could not be processed.');
  }
}

import { InfrastructureException } from '@/shared/application/exceptions/infrastructure.exception';

/** The persisted cart changed (or was created) concurrently with this write. */
export class BuyerCartWriteConflictException extends InfrastructureException {
  constructor() {
    super('Concurrent buyer cart write detected.');
    this.name = 'BuyerCartWriteConflictException';
  }
}

import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class KiviStaleSyncException extends ApplicationException {
  public constructor() {
    super('The Kivi synchronization snapshot is no longer current.');
  }
}

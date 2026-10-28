import { ApplicationException } from '@/shared/application/exceptions/application.exception';

/** The submitted value is not shaped like a Kivi pairing code. Never echoes the value. */
export class InvalidKiviPairingCodeException extends ApplicationException {
  constructor() {
    super('The pairing code is not valid.');
  }
}

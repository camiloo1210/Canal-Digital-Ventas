import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidKiviNotificationRecipientException extends DomainException {
  public constructor(public readonly reason: 'PHONE_INVALID' | 'SNAPSHOT_INVALID') {
    super(`Invalid Kivi notification recipient (${reason})`);
    this.name = 'InvalidKiviNotificationRecipientException';
  }
}

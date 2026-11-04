import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidInvitationException extends DomainException {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidInvitationException';
  }
}

import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvitationNotUsableException extends DomainException {
  constructor(reason: string = 'The invitation is expired, revoked or exhausted') {
    super(reason);
    this.name = 'InvitationNotUsableException';
  }
}

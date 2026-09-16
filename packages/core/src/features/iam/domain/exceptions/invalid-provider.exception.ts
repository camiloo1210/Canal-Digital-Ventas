import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidProviderException extends DomainException {
  constructor(provider: string) {
    super(`Invalid OAuth provider: ${provider}`);
    this.name = 'InvalidProviderException';
  }
}

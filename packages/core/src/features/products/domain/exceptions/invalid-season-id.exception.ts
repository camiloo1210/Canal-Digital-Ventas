import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidSeasonIdException extends DomainException {
  constructor() {
    super('SeasonId cannot be empty');
    this.name = 'InvalidSeasonIdException';
  }
}

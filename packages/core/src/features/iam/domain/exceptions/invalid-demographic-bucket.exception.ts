import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidDemographicBucketException extends DomainException {
  constructor(field: string, value: string) {
    super(`Invalid ${field}: ${value}`);
    this.name = 'InvalidDemographicBucketException';
  }
}

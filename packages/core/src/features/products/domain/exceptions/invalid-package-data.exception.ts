import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidPackageDataException extends DomainException {
  constructor(field: string, value: number) {
    super(`Package ${field} must be a positive integer up to 100000000, received ${value}.`);
  }
}

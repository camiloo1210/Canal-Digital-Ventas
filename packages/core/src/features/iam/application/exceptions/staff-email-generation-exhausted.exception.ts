import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class StaffEmailGenerationExhaustedException extends ApplicationException {
  constructor() {
    super('Could not generate a unique staff email');
    this.name = 'StaffEmailGenerationExhaustedException';
  }
}

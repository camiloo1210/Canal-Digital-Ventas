import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export abstract class InfrastructureException extends ApplicationException {
  constructor(
    message: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'InfrastructureException';
  }
}

import { InfrastructureException } from '@/shared/application/exceptions/infrastructure.exception';

export class BusinessIntelligenceReadException extends InfrastructureException {
  constructor(cause: unknown) {
    super('Unable to read business intelligence', cause);
    this.name = 'BusinessIntelligenceReadException';
  }
}

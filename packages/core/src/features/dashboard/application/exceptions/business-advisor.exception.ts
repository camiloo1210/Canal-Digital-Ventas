import { ApplicationException } from '@/shared/application/exceptions/application.exception';
import { InfrastructureException } from '@/shared/application/exceptions/infrastructure.exception';

/** The AI provider failed, timed out, answered malformed data or is not configured. */
export class BusinessAdvisorException extends InfrastructureException {
  constructor(
    public readonly reason: 'not_configured' | 'unavailable' | 'invalid_response',
    cause?: unknown,
  ) {
    super('Unable to generate business advice', cause);
    this.name = 'BusinessAdvisorException';
  }
}

export class BusinessAdviceAccessDeniedException extends ApplicationException {
  constructor() {
    super('Business advice is not available for this actor and tenant');
    this.name = 'BusinessAdviceAccessDeniedException';
  }
}

import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class KiviKnowledgeLimitException extends ApplicationException {
  public constructor(public readonly limit: number) {
    super(`The knowledge base is limited to ${limit} documents`);
    this.name = 'KiviKnowledgeLimitException';
  }
}

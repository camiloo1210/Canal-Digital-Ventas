import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class InvalidWebhookSignatureException extends ApplicationException {
  constructor(message: string = 'Invalid webhook signature provided') {
    super(message);
    this.name = 'InvalidWebhookSignatureException';
  }
}

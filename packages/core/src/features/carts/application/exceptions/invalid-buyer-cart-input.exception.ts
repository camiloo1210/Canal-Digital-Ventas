import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class InvalidBuyerCartInputException extends ApplicationException {
  constructor(message: string) {
    super(message);
  }
}

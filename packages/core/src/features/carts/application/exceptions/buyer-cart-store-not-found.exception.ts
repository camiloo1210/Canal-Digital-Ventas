import { ApplicationException } from '@/shared/application/exceptions/application.exception';

export class BuyerCartStoreNotFoundException extends ApplicationException {
  constructor() {
    super('Store not found or inactive.');
  }
}

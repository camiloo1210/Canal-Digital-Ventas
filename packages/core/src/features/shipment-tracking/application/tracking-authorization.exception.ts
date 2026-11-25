import { ApplicationException } from '@/shared/application/exceptions/application.exception';
export class TrackingAuthorizationException extends ApplicationException {
  public readonly code = 'TRACKING_AUTHORIZATION';
  public constructor() {
    super('FedEx authorization failed');
  }
}

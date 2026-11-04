import { ApplicationException } from '@/shared/application/exceptions/application.exception';

/** The operation needs the Supabase service role key, which is not configured. */
export class AdminAuthUnavailableException extends ApplicationException {
  constructor() {
    super('Administrative auth access is not configured');
    this.name = 'AdminAuthUnavailableException';
  }
}

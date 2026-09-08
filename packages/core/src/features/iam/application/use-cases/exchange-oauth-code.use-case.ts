import { AuthPort } from '../ports/out/auth.port';
import { SupabaseClient } from '@supabase/supabase-js';

export class ExchangeOAuthCodeUseCase {
  constructor(private readonly authPort: AuthPort) {}

  async execute(code: string, client: SupabaseClient): Promise<void> {
    await this.authPort.exchangeOAuthCode(code, client);
  }
}

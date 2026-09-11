import { AuthPort } from '@/iam/application/ports/out/auth.port';

export class ExchangeOAuthCodeUseCase {
  constructor(private readonly authPort: AuthPort) {}

  async execute(code: string): Promise<void> {
    await this.authPort.exchangeOAuthCode(code);
  }
}

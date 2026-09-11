import { GetOAuthSignInUrlDto } from '@/iam/application/dtos/get-oauth-sign-in-url.dto';
import { AuthPort } from '@/iam/application/ports/out/auth.port';
import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidProviderException extends DomainException {
  constructor(provider: string) {
    super(`Invalid OAuth provider: ${provider}`);
    this.name = 'InvalidProviderException';
  }
}

export type OAuthProvider = 'google' | 'github' | 'azure';

function parseProvider(provider: string): OAuthProvider {
  const validProviders: OAuthProvider[] = ['google', 'github', 'azure'];
  if (!validProviders.includes(provider as OAuthProvider)) {
    throw new InvalidProviderException(provider);
  }
  return provider as OAuthProvider;
}

export class GetOAuthSignInUrlUseCase {
  constructor(private readonly authPort: AuthPort) {}

  async execute(dto: GetOAuthSignInUrlDto): Promise<string> {
    const provider = parseProvider(dto.provider);
    return this.authPort.getOAuthSignInUrl(provider, dto.redirectTo);
  }
}

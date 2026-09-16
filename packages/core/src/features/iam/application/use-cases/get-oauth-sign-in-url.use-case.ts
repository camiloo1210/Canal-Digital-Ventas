import { GetOAuthSignInUrlDto } from '@/iam/application/dtos/get-oauth-sign-in-url.dto';
import { AuthPort } from '@/iam/application/ports/out/auth.port';
import { InvalidProviderException } from '@/iam/domain/exceptions/invalid-provider.exception';
import { OAuthProvider } from '@/iam/domain/types/oauth-provider.type';

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

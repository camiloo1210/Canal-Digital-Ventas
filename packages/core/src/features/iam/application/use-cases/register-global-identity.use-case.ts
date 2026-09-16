import { AuthPort } from '@/iam/application/ports/out/auth.port';
import { RegisterGlobalIdentityDto } from '@/iam/application/dtos/register-global-identity.dto';

export class RegisterGlobalIdentityUseCase {
  constructor(private readonly authPort: AuthPort) {}

  async execute(dto: RegisterGlobalIdentityDto): Promise<string> {
    return await this.authPort.signUpWithEmail(dto.email, dto.password);
  }
}

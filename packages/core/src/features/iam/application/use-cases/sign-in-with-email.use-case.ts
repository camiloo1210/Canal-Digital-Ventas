import { SignInWithEmailDto } from '@/iam/application/dtos/sign-in-with-email.dto';
import { AuthPort } from '@/iam/application/ports/out/auth.port';
import { Email } from '@/shared/domain/value-objects/email.vo';
import { UserId, createUserId } from '@/iam/domain/types/user-id.type';
import { TenantId } from '@/shared/domain/types/tenant-id.type';

export class SignInWithEmailUseCase {
  constructor(private readonly authPort: AuthPort) {}

  async execute(dto: SignInWithEmailDto): Promise<{ userId: UserId; tenantId: TenantId }> {
    const emailVO = Email.create(dto.email);

    const result = await this.authPort.signInWithEmail(emailVO.getValue(), dto.password);

    return {
      userId: createUserId(result.userId),
      tenantId: result.tenantId as TenantId,
    };
  }
}

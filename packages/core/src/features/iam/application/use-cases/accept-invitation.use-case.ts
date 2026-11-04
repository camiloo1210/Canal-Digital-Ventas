import type {
  InvitationAcceptancePort,
  InvitationAcceptanceResult,
} from '@/iam/application/ports/out/invitation-acceptance.port';
import type { TokenGeneratorPort } from '@/iam/application/ports/out/token-generator.port';
import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';
import { AgeRange } from '@/iam/domain/value-objects/age-range.vo';
import { Gender } from '@/iam/domain/value-objects/gender.vo';
import { Province } from '@/iam/domain/value-objects/province.vo';
import { InvalidInvitationException } from '@/iam/domain/exceptions/invalid-invitation.exception';
import { PersonName } from '@/shared/domain/value-objects/person-name.vo';

export interface AcceptInvitationDto {
  /** Raw token from the invitation link. */
  token: string;
  /** Authenticated (already created) user accepting the invitation. */
  userId: string;
  firstName?: string;
  lastName?: string;
  demographicConsent: boolean;
  ageRange?: string;
  gender?: string;
  province?: string;
}

export class AcceptInvitationUseCase {
  public constructor(
    private readonly acceptance: InvitationAcceptancePort,
    private readonly tokens: TokenGeneratorPort,
    private readonly transactions: TransactionManagerPort,
  ) {}

  public async execute(dto: AcceptInvitationDto): Promise<InvitationAcceptanceResult> {
    const token = (dto.token ?? '').trim();
    if (!token) throw new InvalidInvitationException('Invitation token is required');

    const firstName = dto.firstName ? PersonName.create(dto.firstName).getValue() : null;
    const lastName = dto.lastName ? PersonName.create(dto.lastName).getValue() : null;

    // Without consent nothing demographic is read, validated or persisted.
    const consent = dto.demographicConsent === true;
    const ageRange = consent && dto.ageRange ? AgeRange.create(dto.ageRange).getValue() : null;
    const gender = consent && dto.gender ? Gender.create(dto.gender).getValue() : null;
    const province = consent && dto.province ? Province.create(dto.province).getValue() : null;

    return this.transactions.runInTransaction(
      (tx: TransactionContext): Promise<InvitationAcceptanceResult> =>
        this.acceptance.accept(
          {
            tokenHash: this.tokens.hash(token),
            userId: dto.userId,
            consent,
            ageRange,
            gender,
            province,
            firstName,
            lastName,
          },
          tx,
        ),
      { userId: dto.userId },
    );
  }
}

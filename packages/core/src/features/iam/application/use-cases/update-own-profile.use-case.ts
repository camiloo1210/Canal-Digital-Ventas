import type { UserProfileRepositoryPort } from '@/iam/application/ports/out/user-profile-repository.port';
import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';
import { PersonName } from '@/shared/domain/value-objects/person-name.vo';

export interface UpdateOwnProfileDto {
  /** Authenticated user; always edits their own profile. */
  userId: string;
  firstName: string;
  lastName: string;
  demographicConsent: boolean;
}

export class UpdateOwnProfileUseCase {
  public constructor(
    private readonly profiles: UserProfileRepositoryPort,
    private readonly transactions: TransactionManagerPort,
    private readonly now: () => Date = (): Date => new Date(),
  ) {}

  public async execute(dto: UpdateOwnProfileDto): Promise<void> {
    const firstName = PersonName.create(dto.firstName).getValue();
    const lastName = PersonName.create(dto.lastName).getValue();
    const consent = dto.demographicConsent === true;
    await this.transactions.runInTransaction(
      (tx: TransactionContext): Promise<void> =>
        this.profiles.update(
          {
            userId: dto.userId,
            firstName,
            lastName,
            demographicConsent: consent,
            demographicConsentAt: consent ? this.now() : null,
          },
          tx,
        ),
      { userId: dto.userId },
    );
  }
}

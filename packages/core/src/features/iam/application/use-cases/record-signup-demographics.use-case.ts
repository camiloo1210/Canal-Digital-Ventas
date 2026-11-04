import type { SignupDemographicsPort } from '@/iam/application/ports/out/signup-demographics.port';
import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';
import { AgeRange } from '@/iam/domain/value-objects/age-range.vo';
import { Gender } from '@/iam/domain/value-objects/gender.vo';
import { Province } from '@/iam/domain/value-objects/province.vo';

export interface RecordSignupDemographicsDto {
  /** Freshly registered user. */
  userId: string;
  consent: boolean;
  ageRange?: string;
  gender?: string;
  province?: string;
  /** Store the visitor signed up from (already resolved server-side), if any. */
  tenantId?: string | null;
}

/** Client signup: with consent stores one unlinked sample; without it nothing is stored. */
export class RecordSignupDemographicsUseCase {
  public constructor(
    private readonly demographics: SignupDemographicsPort,
    private readonly transactions: TransactionManagerPort,
  ) {}

  public async execute(dto: RecordSignupDemographicsDto): Promise<void> {
    if (dto.consent !== true) return;
    const ageRange = dto.ageRange ? AgeRange.create(dto.ageRange).getValue() : null;
    const gender = dto.gender ? Gender.create(dto.gender).getValue() : null;
    const province = dto.province ? Province.create(dto.province).getValue() : null;
    await this.transactions.runInTransaction(
      (tx: TransactionContext): Promise<void> =>
        this.demographics.record(
          {
            userId: dto.userId,
            consent: true,
            ageRange,
            gender,
            province,
            tenantId: dto.tenantId ?? null,
          },
          tx,
        ),
      { userId: dto.userId },
    );
  }
}

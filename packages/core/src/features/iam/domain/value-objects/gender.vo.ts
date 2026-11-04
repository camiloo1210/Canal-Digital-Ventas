import { InvalidDemographicBucketException } from '@/iam/domain/exceptions/invalid-demographic-bucket.exception';

export const GENDERS = ['FEMALE', 'MALE', 'OTHER', 'PREFER_NOT_TO_SAY'] as const;
export type GenderValue = (typeof GENDERS)[number];

export class Gender {
  private constructor(private readonly value: GenderValue) {}

  public static create(raw: string): Gender {
    const found = GENDERS.find((candidate): boolean => candidate === raw);
    if (!found) throw new InvalidDemographicBucketException('gender', String(raw));
    return new Gender(found);
  }

  public getValue(): GenderValue {
    return this.value;
  }
}

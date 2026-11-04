import { InvalidDemographicBucketException } from '@/iam/domain/exceptions/invalid-demographic-bucket.exception';

export const AGE_RANGES = ['18_24', '25_34', '35_44', '45_54', '55_64', '65_PLUS'] as const;
export type AgeRangeValue = (typeof AGE_RANGES)[number];

export class AgeRange {
  private constructor(private readonly value: AgeRangeValue) {}

  public static create(raw: string): AgeRange {
    const found = AGE_RANGES.find((candidate): boolean => candidate === raw);
    if (!found) throw new InvalidDemographicBucketException('age range', String(raw));
    return new AgeRange(found);
  }

  public getValue(): AgeRangeValue {
    return this.value;
  }
}

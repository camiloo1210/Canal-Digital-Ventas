import type {
  DemographicBucketCount,
  DemographicDimensionStats,
} from '@/iam/application/read-models/user-management.read-models';

/** Buckets smaller than this are never shown (k-anonymity, LOPDP). */
export const DEMOGRAPHIC_MIN_BUCKET_SIZE = 5;

/** Below this many samples for a tenant every dimension is hidden (small-population floor). */
export const DEMOGRAPHIC_MIN_TOTAL_SAMPLES = 20;

export function suppressSmallBuckets(
  counts: readonly DemographicBucketCount[],
  totalSamples: number,
): DemographicDimensionStats {
  if (totalSamples < DEMOGRAPHIC_MIN_TOTAL_SAMPLES) return { buckets: [], hasSuppressed: true };
  const buckets = counts.filter((bucket): boolean => bucket.count >= DEMOGRAPHIC_MIN_BUCKET_SIZE);
  return { buckets, hasSuppressed: buckets.length !== counts.length };
}

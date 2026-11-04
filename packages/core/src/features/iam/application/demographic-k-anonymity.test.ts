import { describe, expect, it } from 'vitest';
import {
  DEMOGRAPHIC_MIN_BUCKET_SIZE,
  DEMOGRAPHIC_MIN_TOTAL_SAMPLES,
  suppressSmallBuckets,
} from '@/iam/application/demographic-k-anonymity';

const ENOUGH = DEMOGRAPHIC_MIN_TOTAL_SAMPLES;

describe('suppressSmallBuckets', () => {
  it('uses k = 5 per bucket and a floor of 20 samples per tenant', () => {
    expect(DEMOGRAPHIC_MIN_BUCKET_SIZE).toBe(5);
    expect(DEMOGRAPHIC_MIN_TOTAL_SAMPLES).toBe(20);
  });

  it('hides buckets below the threshold and flags the suppression', () => {
    expect(
      suppressSmallBuckets(
        [
          { value: 'A', count: 9 },
          { value: 'B', count: 5 },
          { value: 'C', count: 4 },
          { value: 'D', count: 1 },
        ],
        ENOUGH,
      ),
    ).toEqual({
      buckets: [
        { value: 'A', count: 9 },
        { value: 'B', count: 5 },
      ],
      hasSuppressed: true,
    });
  });

  it('reports no suppression when everything is large enough and handles empty', () => {
    expect(suppressSmallBuckets([{ value: 'A', count: 6 }], ENOUGH)).toEqual({
      buckets: [{ value: 'A', count: 6 }],
      hasSuppressed: false,
    });
    expect(suppressSmallBuckets([], ENOUGH)).toEqual({ buckets: [], hasSuppressed: false });
  });

  it('suppresses every bucket while the tenant has fewer than 20 samples in total', () => {
    expect(suppressSmallBuckets([{ value: 'A', count: 19 }], ENOUGH - 1)).toEqual({
      buckets: [],
      hasSuppressed: true,
    });
    expect(suppressSmallBuckets([], 0)).toEqual({ buckets: [], hasSuppressed: true });
  });

  it('shows buckets once the total reaches exactly 20', () => {
    expect(suppressSmallBuckets([{ value: 'A', count: 20 }], 20).buckets).toHaveLength(1);
  });
});

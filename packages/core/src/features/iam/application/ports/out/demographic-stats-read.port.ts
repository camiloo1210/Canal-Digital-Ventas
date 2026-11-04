import type { DemographicStatsReadModel } from '@/iam/application/read-models/user-management.read-models';

export interface DemographicStatsReadPort {
  /** Aggregates only, with buckets below the k-anonymity threshold already suppressed. */
  findForOwner(userId: string, tenantId: string): Promise<DemographicStatsReadModel>;
}

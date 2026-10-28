import type {
  BusinessIntelligenceReport,
  IntelligenceQuery,
} from '@/dashboard/domain/business-intelligence';

export interface BusinessIntelligenceReadPort {
  findForManager(
    userId: string,
    tenantId: string,
    query: IntelligenceQuery,
  ): Promise<BusinessIntelligenceReport | null>;
}

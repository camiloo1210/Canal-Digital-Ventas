import type { BusinessIntelligenceReadPort } from '@/dashboard/application/ports/out/business-intelligence-read.port';
import type {
  AdviceLocale,
  BusinessAdvice,
  BusinessAdvisorPort,
} from '@/dashboard/application/ports/out/business-advisor.port';
import { buildAdvisorDigest } from '@/dashboard/application/business-advisor-digest';
import { BusinessAdviceAccessDeniedException } from '@/dashboard/application/exceptions/business-advisor.exception';

export interface GenerateBusinessAdviceInput {
  readonly authenticatedUserId: string;
  readonly tenantId: string;
  readonly days: number;
  readonly endDate?: string;
  readonly leadTimeDays: number;
  readonly targetCoverageDays: number;
  readonly locale: AdviceLocale;
}

/**
 * Reads the same authorized report the page shows, reduces it to aggregates and asks the advisor.
 * The read port enforces membership and VIEW_REPORTS, so no extra trust is placed in the caller.
 */
export class GenerateBusinessAdviceUseCase {
  constructor(
    private readonly reports: BusinessIntelligenceReadPort,
    private readonly advisor: BusinessAdvisorPort,
  ) {}

  async execute(input: GenerateBusinessAdviceInput): Promise<BusinessAdvice> {
    const report = await this.reports.findForManager(input.authenticatedUserId, input.tenantId, {
      days: input.days,
      ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
      leadTimeDays: input.leadTimeDays,
      targetCoverageDays: input.targetCoverageDays,
    });
    if (!report) throw new BusinessAdviceAccessDeniedException();
    return this.advisor.advise(buildAdvisorDigest(report, input.locale));
  }
}

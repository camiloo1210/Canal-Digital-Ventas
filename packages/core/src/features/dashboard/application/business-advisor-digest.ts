import type {
  BusinessIntelligenceReport,
  IntelligenceProductResult,
} from '@/dashboard/domain/business-intelligence';
import type {
  AdviceLocale,
  BusinessAdvisorDigest,
  DigestProduct,
} from '@/dashboard/application/ports/out/business-advisor.port';

import { currencyExponent } from '@/shared/domain/money-format';

const LIST_LIMIT = 10;

function toDigestProduct(item: IntelligenceProductResult): DigestProduct {
  return {
    name: item.name,
    category: item.category,
    signal: item.signal,
    unitsSold: item.unitsSold,
    revenueCents: item.revenueCents,
    marginBps: item.marginBps,
    stock: item.stock,
    coverageDays: item.coverageDays,
    priceCents: item.priceCents,
  };
}

/** Reduces a report to the facts an advisor needs. Buyer data and identifiers never leave here. */
export function buildAdvisorDigest(
  report: BusinessIntelligenceReport,
  locale: AdviceLocale,
): BusinessAdvisorDigest {
  const weekdays = Array.from(
    { length: 7 },
    (_, weekday): { weekday: number; revenueCents: number; unitsSold: number } => ({
      weekday,
      revenueCents: 0,
      unitsSold: 0,
    }),
  );
  for (const point of report.daily) {
    const bucket = weekdays[new Date(`${point.date}T00:00:00Z`).getUTCDay()];
    bucket.revenueCents += point.revenueCents;
    bucket.unitsSold += point.unitsSold;
  }
  const slow = report.products
    .filter(
      (item): boolean =>
        item.stock > 0 &&
        (item.signal === 'noSales' || item.signal === 'lowMargin') &&
        item.status !== 'inactive',
    )
    .sort(
      (a, b): number => b.stock * b.costCents - a.stock * a.costCents || a.id.localeCompare(b.id),
    );
  return {
    locale,
    currency: report.currency,
    currencyExponent: currencyExponent(report.currency),
    period: {
      start: report.daily[0].date,
      end: report.daily[report.daily.length - 1].date,
      days: report.query.days,
    },
    totals: {
      revenueCents: report.revenueCents,
      previousRevenueCents: report.previousRevenueCents,
      revenueChangeBps: report.revenueChangeBps,
      estimatedProfitCents: report.estimatedProfitCents,
      marginBps: report.marginBps,
      orderCount: report.orderCount,
      unitsSold: report.unitsSold,
      inventoryCostCents: report.inventoryCostCents,
    },
    revenueByWeekday: weekdays,
    topByRevenue: report.productRankings.revenue.map(toDigestProduct),
    topByUnits: report.productRankings.units.map(toDigestProduct),
    restockPriorities: report.priorities.slice(0, LIST_LIMIT).map(toDigestProduct),
    slowMovers: slow.slice(0, LIST_LIMIT).map(toDigestProduct),
    orderFlow: {
      totalOrders: report.orderFlow.totalOrders,
      statusCounts: report.orderFlow.statusCounts.map((row): { status: string; count: number } => ({
        status: row.status,
        count: row.count,
      })),
      averageMinutesPerStage: report.orderFlow.stages.map(
        (stage): { from: string; to: string; averageMinutes: number | null } => ({
          from: stage.from,
          to: stage.to,
          averageMinutes: stage.averageMinutes,
        }),
      ),
      stuckOrders: report.orderFlow.stuckCount,
      stuckThresholdHours: report.orderFlow.stuckThresholdHours,
    },
  };
}

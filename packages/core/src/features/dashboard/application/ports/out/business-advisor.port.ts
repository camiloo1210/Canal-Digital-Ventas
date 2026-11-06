export type AdviceLocale = 'es' | 'en';

export const ADVICE_CATEGORIES = [
  'promotions',
  'bestSellers',
  'restock',
  'pricing',
  'operations',
  'growth',
] as const;
export type AdviceCategory = (typeof ADVICE_CATEGORIES)[number];

export interface BusinessAdviceTip {
  readonly category: AdviceCategory;
  readonly title: string;
  readonly detail: string;
}

export interface BusinessAdvice {
  readonly summary: string;
  readonly tips: readonly BusinessAdviceTip[];
}

export interface DigestProduct {
  readonly name: string;
  readonly category: string;
  readonly signal: string;
  readonly unitsSold: number;
  readonly revenueCents: number;
  readonly marginBps: number | null;
  readonly stock: number;
  readonly coverageDays: number | null;
  readonly priceCents: number;
}

/**
 * Aggregated, customer-free facts about one store and period. Money is in integer minor units of
 * `currency`. Nothing here identifies a buyer.
 */
export interface BusinessAdvisorDigest {
  readonly locale: AdviceLocale;
  readonly currency: string;
  /** Decimal places of the currency's minor unit (0 for CLP, 2 for USD): divide money by 10^exponent. */
  readonly currencyExponent: number;
  readonly period: { readonly start: string; readonly end: string; readonly days: number };
  readonly totals: {
    readonly revenueCents: number;
    readonly previousRevenueCents: number;
    readonly revenueChangeBps: number | null;
    readonly estimatedProfitCents: number;
    readonly marginBps: number | null;
    readonly orderCount: number;
    readonly unitsSold: number;
    readonly inventoryCostCents: number;
  };
  /** Revenue grouped by weekday, 0 = Sunday .. 6 = Saturday, across the whole period. */
  readonly revenueByWeekday: readonly {
    readonly weekday: number;
    readonly revenueCents: number;
    readonly unitsSold: number;
  }[];
  readonly topByRevenue: readonly DigestProduct[];
  readonly topByUnits: readonly DigestProduct[];
  readonly restockPriorities: readonly DigestProduct[];
  /** Sellable products with stock but no sales or a thin margin. */
  readonly slowMovers: readonly DigestProduct[];
  readonly orderFlow: {
    readonly totalOrders: number;
    readonly statusCounts: readonly { readonly status: string; readonly count: number }[];
    readonly averageMinutesPerStage: readonly {
      readonly from: string;
      readonly to: string;
      readonly averageMinutes: number | null;
    }[];
    readonly stuckOrders: number;
    readonly stuckThresholdHours: number;
  };
}

export interface BusinessAdvisorPort {
  advise(digest: BusinessAdvisorDigest): Promise<BusinessAdvice>;
}

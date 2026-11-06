import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export const MAX_INTELLIGENCE_DAYS = 366;
export const STUCK_ORDER_HOURS = 48;

export interface IntelligenceQuery {
  /** Length of the analysed period in whole UTC days (1..366). */
  readonly days: number;
  /** Inclusive last day (YYYY-MM-DD, UTC). Omitted means the period ends yesterday. */
  readonly endDate?: string;
  readonly leadTimeDays: number;
  readonly targetCoverageDays: number;
}

export interface IntelligenceProduct {
  readonly id: string;
  readonly name: string;
  readonly sku: string;
  readonly category: string;
  readonly stock: number;
  readonly costCents: number;
  readonly priceCents: number;
  readonly status: string;
  readonly hasVariants: boolean;
}

export interface IntelligenceSnapshot {
  readonly observedAt: string;
  readonly currency: string;
  readonly products: readonly IntelligenceProduct[];
  readonly orders: readonly {
    id: string;
    createdAt: string;
    currency: string;
    discountCents: number;
    items: readonly { productId: string; quantity: number; subtotalCents: number }[];
  }[];
  /** Orders created in the analysed window (any status) plus every order still in an open stage. */
  readonly flowOrders: readonly IntelligenceFlowOrder[];
}

export interface IntelligenceFlowOrder {
  readonly id: string;
  readonly orderNumber: string;
  readonly status: string;
  readonly createdAt: string;
  readonly transitions: readonly { status: string; at: string }[];
}

export const FLOW_STATUSES = [
  'confirmed',
  'pending_payment',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
] as const;
export type FlowStatus = (typeof FLOW_STATUSES)[number];

const OPEN_STATUSES: readonly string[] = [
  'confirmed',
  'pending_payment',
  'paid',
  'processing',
  'shipped',
];
const STAGES: readonly (readonly [FlowStatus, FlowStatus])[] = [
  ['pending_payment', 'paid'],
  ['paid', 'processing'],
  ['processing', 'shipped'],
  ['shipped', 'delivered'],
  ['confirmed', 'paid'],
];

export interface OrderFlowStage {
  readonly from: FlowStatus;
  readonly to: FlowStatus;
  readonly averageMinutes: number | null;
  readonly samples: number;
}

export interface StuckOrder {
  readonly id: string;
  readonly orderNumber: string;
  readonly status: FlowStatus;
  readonly hoursInStatus: number;
}

export interface OrderFlowReport {
  readonly totalOrders: number;
  readonly statusCounts: readonly { status: FlowStatus; count: number }[];
  readonly stages: readonly OrderFlowStage[];
  readonly stuckThresholdHours: number;
  readonly stuckCount: number;
  readonly stuckOrders: readonly StuckOrder[];
}

export type IntelligenceSignal =
  'outOfStock' | 'restock' | 'noSales' | 'lowMargin' | 'healthy' | 'inactive' | 'variants';

export interface IntelligenceProductResult extends IntelligenceProduct {
  readonly unitsSold: number;
  readonly revenueCents: number;
  readonly estimatedProfitCents: number;
  readonly marginBps: number | null;
  readonly coverageDays: number | null;
  readonly restockUnits: number;
  readonly signal: IntelligenceSignal;
}

export interface BusinessIntelligenceReport {
  readonly observedAt: string;
  readonly currency: string;
  readonly query: IntelligenceQuery;
  readonly revenueCents: number;
  readonly previousRevenueCents: number;
  readonly revenueChangeBps: number | null;
  readonly estimatedProfitCents: number;
  readonly marginBps: number | null;
  /** Orders in either comparison window whose money is excluded because its currency differs. */
  readonly excludedCurrencyOrders: number;
  readonly orderCount: number;
  readonly orderFlow: OrderFlowReport;
  readonly unitsSold: number;
  readonly restockCount: number;
  readonly inventoryCostCents: number;
  readonly products: readonly IntelligenceProductResult[];
  readonly priorities: readonly IntelligenceProductResult[];
  readonly productRankings: {
    readonly revenue: readonly IntelligenceProductResult[];
    readonly units: readonly IntelligenceProductResult[];
  };
  readonly daily: readonly IntelligenceDailyPoint[];
}

export interface IntelligenceDailyPoint {
  readonly date: string;
  readonly previousDate: string;
  readonly revenueCents: number;
  readonly previousRevenueCents: number;
  readonly estimatedProfitCents: number;
  readonly previousEstimatedProfitCents: number;
  readonly unitsSold: number;
  readonly previousUnitsSold: number;
}

type Mutable<T> = { -readonly [Key in keyof T]: T[Key] };

class IntelligenceDataException extends DomainException {
  constructor() {
    super('Invalid business intelligence data or scenario');
  }
}

function integer(value: number, minimum = 0): bigint {
  if (!Number.isSafeInteger(value) || value < minimum) throw new IntelligenceDataException();
  return BigInt(value);
}

function safe(value: bigint): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new IntelligenceDataException();
  return number;
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : safe((BigInt(numerator) * BigInt(10000)) / BigInt(denominator));
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function isCalendarDay(value: string): boolean {
  if (!ISO_DAY.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

function analyzeOrderFlow(
  flowOrders: readonly IntelligenceFlowOrder[],
  start: number,
  end: number,
  observedAt: number,
): OrderFlowReport {
  const counts = new Map<FlowStatus, number>(
    FLOW_STATUSES.map((s): [FlowStatus, number] => [s, 0]),
  );
  const sums = STAGES.map((): { total: number; samples: number } => ({ total: 0, samples: 0 }));
  const stuck: StuckOrder[] = [];
  let totalOrders = 0;
  for (const order of flowOrders) {
    const created = new Date(order.createdAt).getTime();
    if (!Number.isFinite(created)) throw new IntelligenceDataException();
    const entered = new Map<string, number>();
    for (const transition of order.transitions) {
      const at = new Date(transition.at).getTime();
      if (!Number.isFinite(at)) throw new IntelligenceDataException();
      const previous = entered.get(transition.status);
      if (previous === undefined || at < previous) entered.set(transition.status, at);
    }
    const status = FLOW_STATUSES.find((candidate): boolean => candidate === order.status);
    if (!status) continue;
    if (created >= start && created < end) {
      totalOrders++;
      counts.set(status, (counts.get(status) ?? 0) + 1);
      STAGES.forEach(([from, to], index): void => {
        const a = entered.get(from);
        const b = entered.get(to);
        if (a === undefined || b === undefined || b < a) return;
        sums[index].total += Math.round((b - a) / 60000);
        sums[index].samples++;
      });
    }
    if (OPEN_STATUSES.includes(status)) {
      const since = entered.get(status) ?? created;
      const hours = Math.floor(Math.max(0, observedAt - since) / 3600000);
      if (hours >= STUCK_ORDER_HOURS)
        stuck.push({
          id: order.id,
          orderNumber: order.orderNumber,
          status,
          hoursInStatus: hours,
        });
    }
  }
  stuck.sort((a, b): number => b.hoursInStatus - a.hoursInStatus || a.id.localeCompare(b.id));
  return {
    totalOrders,
    statusCounts: FLOW_STATUSES.map((status): { status: FlowStatus; count: number } => ({
      status,
      count: counts.get(status) ?? 0,
    })),
    stages: STAGES.map(([from, to], index): OrderFlowStage => ({
      from,
      to,
      averageMinutes:
        sums[index].samples === 0 ? null : Math.round(sums[index].total / sums[index].samples),
      samples: sums[index].samples,
    })),
    stuckThresholdHours: STUCK_ORDER_HOURS,
    stuckCount: stuck.length,
    stuckOrders: stuck.slice(0, 5),
  };
}

/** Reporting policy. All money stays in integer minor units, including discount allocation. */
export function analyzeBusinessIntelligence(
  snapshot: IntelligenceSnapshot,
  query: IntelligenceQuery,
): BusinessIntelligenceReport {
  if (
    !Number.isInteger(query.days) ||
    query.days < 1 ||
    query.days > MAX_INTELLIGENCE_DAYS ||
    (query.endDate !== undefined && !isCalendarDay(query.endDate)) ||
    !Number.isInteger(query.leadTimeDays) ||
    !Number.isInteger(query.targetCoverageDays) ||
    query.leadTimeDays < 1 ||
    query.leadTimeDays > 90 ||
    query.targetCoverageDays < 1 ||
    query.targetCoverageDays > 90
  )
    throw new IntelligenceDataException();
  const observed = new Date(snapshot.observedAt);
  if (!Number.isFinite(observed.getTime())) throw new IntelligenceDataException();
  const day = 86400000;
  const end =
    query.endDate === undefined
      ? Date.UTC(observed.getUTCFullYear(), observed.getUTCMonth(), observed.getUTCDate())
      : Date.parse(`${query.endDate}T00:00:00Z`) + day;
  const start = end - query.days * day;
  const previousStart = start - query.days * day;
  const daily = Array.from({ length: query.days }, (_, index): Mutable<IntelligenceDailyPoint> => ({
    date: new Date(start + index * day).toISOString().slice(0, 10),
    previousDate: new Date(previousStart + index * day).toISOString().slice(0, 10),
    revenueCents: 0,
    previousRevenueCents: 0,
    estimatedProfitCents: 0,
    previousEstimatedProfitCents: 0,
    unitsSold: 0,
    previousUnitsSold: 0,
  }));
  const products = snapshot.products.map((product): Mutable<IntelligenceProductResult> => {
    integer(product.costCents);
    integer(product.priceCents);
    integer(product.stock);
    return {
      ...product,
      unitsSold: 0,
      revenueCents: 0,
      estimatedProfitCents: 0,
      marginBps: null,
      coverageDays: null,
      restockUnits: 0,
      signal: 'noSales',
    };
  });
  const byId = new Map(
    products.map((product): [string, Mutable<IntelligenceProductResult>] => [product.id, product]),
  );
  let revenue = BigInt(0);
  let previousRevenue = BigInt(0);
  let profit = BigInt(0);
  let orderCount = 0;
  let unitsSold = 0;
  let excludedCurrencyOrders = 0;
  for (const order of snapshot.orders) {
    const time = new Date(order.createdAt).getTime();
    if (!Number.isFinite(time)) throw new IntelligenceDataException();
    if (time < previousStart || time >= end) continue;
    const gross = order.items.reduce(
      (sum: bigint, item): bigint => sum + integer(item.subtotalCents),
      BigInt(0),
    );
    const orderDiscount = integer(order.discountCents);
    // Merchandise-first reporting allocation. Excess discount belongs to excluded tax/shipping.
    const discount = orderDiscount > gross ? gross : orderDiscount;
    const sameCurrency = order.currency === snapshot.currency;
    if (!sameCurrency) excludedCurrencyOrders++;
    const net = sameCurrency ? gross - discount : BigInt(0);
    const current = time >= start;
    const bucket = daily[Math.floor((time - (current ? start : previousStart)) / day)];
    if (current) {
      revenue += net;
      orderCount++;
      bucket.revenueCents = safe(BigInt(bucket.revenueCents) + net);
    } else {
      previousRevenue += net;
      bucket.previousRevenueCents = safe(BigInt(bucket.previousRevenueCents) + net);
    }
    // Cumulative allocation preserves every minor unit, even for small discounts.
    let cumulative = BigInt(0);
    let allocated = BigInt(0);
    for (const item of order.items) {
      const product = byId.get(item.productId);
      if (!product) throw new IntelligenceDataException();
      const quantity = integer(item.quantity, 1);
      cumulative += integer(item.subtotalCents);
      const nextAllocation = gross === BigInt(0) ? BigInt(0) : (discount * cumulative) / gross;
      const itemRevenue = sameCurrency
        ? BigInt(item.subtotalCents) - (nextAllocation - allocated)
        : BigInt(0);
      allocated = nextAllocation;
      const itemProfit = sameCurrency
        ? itemRevenue - quantity * BigInt(product.costCents)
        : BigInt(0);
      if (!current) {
        bucket.previousEstimatedProfitCents = safe(
          BigInt(bucket.previousEstimatedProfitCents) + itemProfit,
        );
        bucket.previousUnitsSold = safe(BigInt(bucket.previousUnitsSold) + quantity);
        continue;
      }
      bucket.estimatedProfitCents = safe(BigInt(bucket.estimatedProfitCents) + itemProfit);
      bucket.unitsSold = safe(BigInt(bucket.unitsSold) + quantity);
      product.unitsSold = safe(BigInt(product.unitsSold) + quantity);
      product.revenueCents = safe(BigInt(product.revenueCents) + itemRevenue);
      product.estimatedProfitCents = safe(BigInt(product.estimatedProfitCents) + itemProfit);
      unitsSold = safe(BigInt(unitsSold) + quantity);
      profit += itemProfit;
    }
  }
  let inventoryCost = BigInt(0);
  let restockCount = 0;
  for (const product of products) {
    product.marginBps = ratio(product.estimatedProfitCents, product.revenueCents);
    const sellable = product.status === 'active' || product.status === 'out_of_stock';
    if (sellable && !product.hasVariants)
      inventoryCost += BigInt(product.stock) * BigInt(product.costCents);
    if (!sellable) {
      product.signal = 'inactive';
      continue;
    }
    if (product.hasVariants) {
      product.signal = 'variants';
      continue;
    }
    if (product.unitsSold > 0) {
      product.coverageDays = safe(
        (BigInt(product.stock) * BigInt(query.days)) / BigInt(product.unitsSold),
      );
      const targetDays = Math.max(query.targetCoverageDays, query.leadTimeDays);
      const target =
        (BigInt(product.unitsSold) * BigInt(targetDays) + BigInt(query.days) - BigInt(1)) /
        BigInt(query.days);
      product.restockUnits = safe(
        target > BigInt(product.stock) ? target - BigInt(product.stock) : BigInt(0),
      );
    }
    if (product.stock === 0) product.signal = 'outOfStock';
    else if (product.coverageDays !== null && product.coverageDays <= query.leadTimeDays)
      product.signal = 'restock';
    else if (product.unitsSold === 0) product.signal = 'noSales';
    else if (product.marginBps !== null && product.marginBps < 2000) product.signal = 'lowMargin';
    else product.signal = 'healthy';
    if (product.signal === 'restock' || product.signal === 'outOfStock') restockCount++;
    else product.restockUnits = 0;
  }
  return {
    observedAt: snapshot.observedAt,
    currency: snapshot.currency,
    query,
    revenueCents: safe(revenue),
    previousRevenueCents: safe(previousRevenue),
    revenueChangeBps:
      previousRevenue === BigInt(0)
        ? null
        : safe(((revenue - previousRevenue) * BigInt(10000)) / previousRevenue),
    estimatedProfitCents: safe(profit),
    marginBps: ratio(safe(profit), safe(revenue)),
    orderCount,
    excludedCurrencyOrders,
    orderFlow: analyzeOrderFlow(snapshot.flowOrders, start, end, observed.getTime()),
    unitsSold,
    restockCount,
    inventoryCostCents: safe(inventoryCost),
    products,
    productRankings: {
      revenue: products
        .filter((product): boolean => product.revenueCents > 0)
        .sort((a, b): number => b.revenueCents - a.revenueCents || a.id.localeCompare(b.id))
        .slice(0, 5),
      units: products
        .filter((product): boolean => product.unitsSold > 0)
        .sort((a, b): number => b.unitsSold - a.unitsSold || a.id.localeCompare(b.id))
        .slice(0, 5),
    },
    priorities: products
      .filter((product): boolean => product.signal === 'outOfStock' || product.signal === 'restock')
      .sort(
        (a, b): number =>
          Number(b.stock === 0) - Number(a.stock === 0) ||
          (a.coverageDays ?? Infinity) - (b.coverageDays ?? Infinity) ||
          b.unitsSold - a.unitsSold ||
          a.id.localeCompare(b.id),
      ),
    daily,
  };
}

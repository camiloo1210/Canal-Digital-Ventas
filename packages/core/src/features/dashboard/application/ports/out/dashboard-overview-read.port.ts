/** Reporting period in whole UTC days. `endDate` is the inclusive last day; omitted means yesterday. */
export interface DashboardOverviewPeriod {
  readonly days: number;
  readonly endDate?: string;
}

export interface DashboardOverviewKpis {
  readonly currency: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly revenueCents: number;
  readonly previousRevenueCents: number;
  readonly revenueChangeBps: number | null;
  readonly excludedCurrencyOrders: number;
  readonly orderCount: number;
  readonly lifetimeRevenueCents: number;
  readonly lifetimeOrderCount: number;
  readonly totalCustomers: number;
  readonly buyingCustomers: number;
}

export interface DashboardOverviewReadModel {
  readonly kpis: DashboardOverviewKpis;
  readonly tenantName: string;
  readonly tenantSlug: string;
  readonly observedAt: string;
  readonly awaitingPreparation: number;
  readonly processing: number;
  readonly shipped: number;
  readonly pendingPayment: number;
  readonly activeProducts: number;
  readonly activeCategories: number;
  readonly outOfStock: number;
  readonly withoutImage: number;
  readonly recentOrders: readonly {
    id: string;
    orderNumber: string;
    status: string;
    createdAt: string;
    customerName: string;
    totalAmountCents: number;
    currency: string;
  }[];
}

export interface DashboardOverviewReadPort {
  findForManager(
    userId: string,
    tenantId: string,
    period: DashboardOverviewPeriod,
  ): Promise<DashboardOverviewReadModel | null>;
}

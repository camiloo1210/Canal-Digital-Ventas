export interface DashboardOverviewReadModel {
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
  findForManager(userId: string, tenantId: string): Promise<DashboardOverviewReadModel | null>;
}

export interface ChangeOrderStatusDto {
  readonly orderId: string;
  readonly tenantId: string;
  readonly status: string;
  readonly authenticatedSellerId: string;
  readonly expectedVersion: number;
}

export interface SellerOrderReadModel {
  readonly id: string;
  readonly orderNumber: string;
  readonly status: string;
  readonly nextStatus: string | null;
  readonly version: number;
  readonly totalAmountCents: number;
  readonly currency: string;
  readonly createdAt: string;
  readonly customerName: string;
  readonly shippingAddress: string;
  readonly items: readonly {
    readonly id: string;
    readonly productName: string;
    readonly quantity: number;
  }[];
}

export interface SellerOrderPage {
  readonly items: readonly SellerOrderReadModel[];
  readonly page: number;
  readonly hasNext: boolean;
}

export interface SellerOrderReadModel {
  readonly id: string;
  readonly orderNumber: string;
  readonly status: string;
  readonly nextStatus: string | null;
  readonly version: number;
  readonly shipmentAvailability?: 'available' | 'unavailable';
  readonly shipment?: {
    readonly carrier: string | null;
    readonly trackingNumber: string | null;
    readonly version: number;
  } | null;
  readonly canManageShipment?: boolean;
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
  readonly authorized: boolean;
  readonly totalItems: number;
  readonly totalPages: number;
  readonly items: readonly SellerOrderReadModel[];
  readonly page: number;
  readonly hasNext: boolean;
}

export interface SellerOrderFilters {
  readonly query?: string;
  readonly status?: string;
  readonly orderId?: string;
}

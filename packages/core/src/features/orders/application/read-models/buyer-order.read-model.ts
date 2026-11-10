export interface BuyerOrderItemReadModel {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
  imageUrl: string | null;
}

export interface BuyerOrderHistoryEntry {
  status: string;
  changedAt: string | null;
}

export interface BuyerOrderReadModel {
  id: string;
  orderNumber: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  status: string;
  currency: string;
  totalAmountCents: number;
  subtotalCents: number;
  taxAmountCents: number;
  shippingCostCents: number;
  createdAt: string;
  canCancel: boolean;
  nextStep?: 'await_preparation' | 'await_shipment' | 'await_delivery' | null;
  shippingAddress?: string;
  paymentStatus?: 'pending' | 'completed' | 'refunded' | 'partially_refunded' | 'unavailable';
  history: BuyerOrderHistoryEntry[] | null;
  shipmentAvailability?: 'available' | 'unavailable';
  shipment?: { carrier: string | null; trackingNumber: string | null } | null;
  items: BuyerOrderItemReadModel[];
}

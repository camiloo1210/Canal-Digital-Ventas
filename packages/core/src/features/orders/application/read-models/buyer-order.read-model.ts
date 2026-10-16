export interface BuyerOrderItemReadModel {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
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
  items: BuyerOrderItemReadModel[];
}

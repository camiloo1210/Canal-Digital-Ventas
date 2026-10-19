/** Trusted read projection. Prices and names come from the order, images from the catalog. */
export interface NotificationOrderItem {
  name: string;
  sku: string;
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
  imageUrl: string | null;
}

export interface NotificationOrderDetails {
  orderId: string;
  tenantSlug: string;
  logoUrl: string | null;
  contactEmail: string | null;
  customerName: string;
  createdAt: string;
  currency: string;
  subtotalCents: number;
  taxAmountCents: number;
  discountAmountCents: number;
  shippingCostCents: number;
  totalAmountCents: number;
  shippingAddress: string;
  items: NotificationOrderItem[];
}

export interface NotificationPresentationCopy {
  eyebrow: string;
  order: string;
  placedOn: string;
  summary: string;
  quantity: string;
  subtotal: string;
  tax: string;
  discount: string;
  shipping: string;
  total: string;
  delivery: string;
  customer: string;
  viewOrder: string;
  visitStore: string;
  support: string;
  footer: string;
  moreItems: string;
  stock: string;
  availability: string;
  sku: string;
}

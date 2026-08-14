export interface DbOrderItemRow {
  id: string;
  order_id: string;
  product_id: string;
  variant_id: string | null;
  product_name: string;
  sku: string;
  unit_price_cents: number;
  quantity: number;
  subtotal_cents: number;
  created_at: string;
  updated_at: string;
}

export interface DbOrderRow {
  id: string;
  order_number: string;
  customer_id: string;
  tenant_id: number;
  status: string;
  subtotal_cents: number;
  tax_amount_cents: number;
  discount_amount_cents: number;
  shipping_cost_cents: number;
  total_amount_cents: number;
  shipping_address: {
    street: string;
    city: string;
    state: string;
    country: string;
    zipCode: string;
    reference?: string;
  } | null;
  payment_gateway_id: string | null;
  created_at: string;
  updated_at: string;

  // Supabase JOIN generated relation
  order_items?: DbOrderItemRow[];
}

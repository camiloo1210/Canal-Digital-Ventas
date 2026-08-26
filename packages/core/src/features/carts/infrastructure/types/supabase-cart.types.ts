export interface DbCartItemRow {
  id: string;
  cart_id: string;
  product_id: string;
  variant_id: string | null;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price_cents: number;
  subtotal_cents: number;
  created_at: string;
  updated_at: string;
}

export interface DbCartRow {
  id: string;
  tenant_id: number;
  customer_id: string | null;
  status: string;
  subtotal_cents: number;
  expires_at: string;
  created_at: string;
  updated_at: string;
  version: number;

  // Supabase JOIN generated relation
  cart_items?: DbCartItemRow[];
}

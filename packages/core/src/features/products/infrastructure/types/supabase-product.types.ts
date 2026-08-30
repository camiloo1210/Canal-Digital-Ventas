// TODO: Review the database generated types to see if they are correct and if they need to be updated.
export interface DbProductVariantRow {
  id: string;
  product_id: string;
  sku: string;
  name: string;
  attributes: Record<string, string>;
  price_override_cents: number | null;
  stock: number;
  status: string;
}

export interface DbProductRow {
  id: string;
  name: string;
  price_cents: number;
  cost_cents: number;
  wholesale_price_cents: number;
  description: string;
  stock: number;
  category_id: string;
  expiration_date: string | null;
  status: string;
  sku: string;
  tenant_id: string;
  season_ids: string[];
  image_path: string | null;
  image_url: string | null;
  has_variants: boolean;
  is_vat_exempt: boolean;
  // Supabase JOIN generated relation
  product_variants?: DbProductVariantRow[];
}

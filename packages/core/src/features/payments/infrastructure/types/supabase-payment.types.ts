export interface DbPaymentRow {
  id: string;
  order_id: string;
  tenant_id: number;
  customer_id: string;
  status: string;
  gateway: string;
  amount_cents: number;
  gateway_transaction_id: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

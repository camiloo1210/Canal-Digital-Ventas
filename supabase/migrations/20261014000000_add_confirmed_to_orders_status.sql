-- Migration to add 'confirmed' status to sales.orders status constraint
ALTER TABLE sales.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE sales.orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN ('draft', 'confirmed', 'pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'));

-- Fix the foreign key constraint on sales.orders to point to sales.customers instead of public.customers
ALTER TABLE sales.orders DROP CONSTRAINT IF EXISTS orders_customer_id_fkey;

ALTER TABLE sales.orders 
ADD CONSTRAINT orders_customer_id_fkey 
FOREIGN KEY (customer_id) 
REFERENCES sales.customers(id);

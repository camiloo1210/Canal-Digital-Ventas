-- Carts carry the currency of their store explicitly; it is never assumed.
-- Legacy rows are backfilled from the owning tenant's base currency.
BEGIN;

ALTER TABLE sales.carts ADD COLUMN IF NOT EXISTS currency varchar(3);

DO $$
BEGIN
  UPDATE sales.carts c SET currency = t.base_currency
  FROM core.tenants t
  WHERE t.id = c.tenant_id AND c.currency IS NULL;
END;
$$;

ALTER TABLE sales.carts ALTER COLUMN currency SET NOT NULL;

ALTER TABLE sales.carts DROP CONSTRAINT IF EXISTS carts_currency_supported;
ALTER TABLE sales.carts ADD CONSTRAINT carts_currency_supported
  CHECK (currency IN ('USD','EUR','COP','MXN','ARS','BRL','CLP','PEN'));

COMMIT;

-- Sender (origin) address each store ships from. Written by the application transactor
-- (table owner) after it verified the MANAGE_STORE permission; read later by the carrier worker.
CREATE TABLE core.tenant_shipping_origins (
  tenant_id uuid PRIMARY KEY REFERENCES core.tenants (id) ON DELETE CASCADE,
  contact_name text NOT NULL CHECK (char_length(contact_name) BETWEEN 1 AND 120),
  phone text NOT NULL CHECK (char_length(phone) BETWEEN 1 AND 120),
  street text NOT NULL CHECK (char_length(street) BETWEEN 1 AND 120),
  city text NOT NULL CHECK (char_length(city) BETWEEN 1 AND 120),
  state text NOT NULL CHECK (char_length(state) BETWEEN 1 AND 120),
  zip_code text NOT NULL CHECK (char_length(zip_code) BETWEEN 1 AND 120),
  country char(2) NOT NULL CHECK (country ~ '^[A-Z]{2}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE core.tenant_shipping_origins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON core.tenant_shipping_origins FROM PUBLIC, anon, authenticated, service_role;
-- No browser role gets access: the application transactor (table owner, which bypasses RLS)
-- reads and writes after checking MANAGE_STORE server-side; the worker role gets read-only
-- grants in 20261110030000.

-- The cart retention worker calls core.purge_expired_buyer_carts(integer), but its group role was
-- never allowed to resolve objects in schema core, so every call failed with
-- "permission denied for schema core". USAGE is all it needs: the function itself is SECURITY
-- DEFINER and is the only object the worker can execute.
BEGIN;

GRANT USAGE ON SCHEMA core TO cart_retention_role;

COMMIT;

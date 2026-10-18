-- New process identities; passwords are provisioned separately and never stored in migration history.
BEGIN;
DO $$ DECLARE actor text; BEGIN
  FOREACH actor IN ARRAY ARRAY['canaldigital_payment_egress','canaldigital_payment_retention'] LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=actor) THEN
      EXECUTE format('CREATE ROLE %I LOGIN INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD NULL CONNECTION LIMIT 2',actor);
    END IF;
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=actor AND (NOT rolcanlogin OR NOT rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)) THEN RAISE EXCEPTION 'Unsafe payment runtime identity'; END IF;
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I',current_database(),actor);
    EXECUTE format('ALTER ROLE %I SET statement_timeout=''15s''',actor);
    EXECUTE format('ALTER ROLE %I SET lock_timeout=''5s''',actor);
    EXECUTE format('ALTER ROLE %I SET idle_in_transaction_session_timeout=''30s''',actor);
  END LOOP;
END $$;
GRANT payment_egress_role TO canaldigital_payment_egress;
GRANT payment_retention_role TO canaldigital_payment_retention;
COMMIT;

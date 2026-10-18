-- Provision dedicated database logins after the messaging migrations.
-- New logins deliberately have no password. Configure their passwords through
-- the production SQL console or secret provisioning process, never in Git.
-- Existing login passwords are preserved when this migration is applied.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'canaldigital_outbox') THEN
    CREATE ROLE canaldigital_outbox
      LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
      NOREPLICATION NOBYPASSRLS PASSWORD NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'canaldigital_notifications') THEN
    CREATE ROLE canaldigital_notifications
      LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
      NOREPLICATION NOBYPASSRLS PASSWORD NULL;
  END IF;

  -- Fail rather than silently reuse a privileged or non-login account.
  IF EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname IN ('canaldigital_outbox', 'canaldigital_notifications')
      AND (NOT rolcanlogin OR NOT rolinherit OR rolsuper OR rolcreatedb
           OR rolcreaterole OR rolreplication OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'Messaging workers require unprivileged inheriting login roles';
  END IF;

  -- Resolve the database name at deployment time for local and hosted Postgres.
  EXECUTE format(
    'GRANT CONNECT ON DATABASE %I TO canaldigital_outbox, canaldigital_notifications',
    current_database()
  );
END;
$$;

-- Conservative limits, idempotent for new and existing logins. Each worker uses
-- one connection (max: 1) plus one for reconnect overlap. Passwords are untouched.
ALTER ROLE canaldigital_outbox WITH CONNECTION LIMIT 2;
ALTER ROLE canaldigital_outbox SET statement_timeout = '15s';
ALTER ROLE canaldigital_outbox SET lock_timeout = '5s';
ALTER ROLE canaldigital_outbox SET idle_in_transaction_session_timeout = '30s';

ALTER ROLE canaldigital_notifications WITH CONNECTION LIMIT 2;
ALTER ROLE canaldigital_notifications SET statement_timeout = '15s';
ALTER ROLE canaldigital_notifications SET lock_timeout = '5s';
ALTER ROLE canaldigital_notifications SET idle_in_transaction_session_timeout = '30s';

-- Group roles own the narrowly scoped RPC permissions from earlier migrations.
-- Worker logins receive no direct table access or application/auth roles.
GRANT outbox_worker_role TO canaldigital_outbox;
GRANT notification_worker_role TO canaldigital_notifications;

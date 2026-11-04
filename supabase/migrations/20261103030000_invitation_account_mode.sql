-- How an invited person gets an account, chosen by the owner when the invitation is created:
--   GENERATED_EMAIL (default): the system derives a non-deliverable login email inside the tenant.
--   REAL_EMAIL: the person types their own email.
--   GOOGLE: the person signs in with Google.
-- accept_invitation keeps its signature; the mode is enforced by the web backend before it runs.
-- Rows created before this migration take the default.
BEGIN;

ALTER TABLE core.tenant_invitations
  ADD COLUMN IF NOT EXISTS account_mode text NOT NULL DEFAULT 'GENERATED_EMAIL';

ALTER TABLE core.tenant_invitations
  DROP CONSTRAINT IF EXISTS tenant_invitations_account_mode_check;
ALTER TABLE core.tenant_invitations
  ADD CONSTRAINT tenant_invitations_account_mode_check
  CHECK (account_mode IN ('GENERATED_EMAIL', 'REAL_EMAIL', 'GOOGLE'));

COMMIT;

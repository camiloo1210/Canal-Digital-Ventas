-- Auth permissions smoke test. NOT executed by CI or by the AI agent: a human runs it once against a
-- STAGING database after the migrations up to 20261103070000_business_account_single_tenant.sql are applied.
--
-- HOW TO RUN (as the same role that applies migrations and that the web server connects with, i.e.
-- postgres on Supabase):
--
--   psql "$STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/auth-permissions-smoke.sql
--
-- Everything runs inside one transaction that ends with ROLLBACK, so nothing is kept. It still takes
-- row locks and fires triggers, so do not run it against production.
--
-- OUTPUT: one NOTICE per check, "PASS: ..." or "FAIL: ...", then "SMOKE SUMMARY: n failure(s)".
-- Any FAIL means the matching behaviour is NOT guaranteed by the database.
--
-- WHAT A FAILURE MEANS AND THE FALLBACK
--   Checks 1 to 5 (writing auth.users / auth.sessions / auth.refresh_tokens, the membership trigger
--   path, core.revoke_user_sessions): the owner of the SECURITY DEFINER functions lacks privileges on
--   the auth schema. Either run ALTER FUNCTION ... OWNER TO a role that has them (postgres or
--   supabase_auth_admin) or, if the platform forbids it, drop that behaviour from SQL and do it from
--   the server with the Auth admin API instead: supabase.auth.admin.updateUserById(id, {
--   ban_duration: '876000h' }) to ban, ban_duration: 'none' to unban, and
--   supabase.auth.admin.signOut(jwt, 'global') to close sessions, called AFTER the membership
--   transaction commits (never inside it).
--   Checks 6 and 7 (last owner, tenant cascade, category foreign key): a migration did not apply as
--   written. For the tenant cascade check see the comment in 20261103060000_audit_fixes.sql.
--   Check 10 (single company rule): migration 20261103070000 did not apply, or the invitation / role
--   insert in 10d does not match the live column list (adjust the throwaway insert, not the rule).
--   Checks 8 and 9 (API roles): a function or table grants more than intended. Fix with REVOKE.

\set ON_ERROR_STOP on

BEGIN;

CREATE FUNCTION pg_temp.smoke_report(p_name text, p_ok boolean, p_detail text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_ok THEN
    RAISE NOTICE 'PASS: %', p_name;
  ELSE
    RAISE NOTICE 'FAIL: % %', p_name, COALESCE('(' || p_detail || ')', '');
    PERFORM pg_catalog.set_config(
      'smoke.failures',
      (COALESCE(NULLIF(pg_catalog.current_setting('smoke.failures', true), ''), '0')::integer + 1)::text,
      true);
  END IF;
END;
$$;

DO $$
DECLARE
  v_t1 uuid := gen_random_uuid();   -- tenant that manages the business account
  v_t2 uuid := gen_random_uuid();   -- another tenant
  v_t3 uuid := gen_random_uuid();   -- tenant deleted as a whole
  v_owner uuid := gen_random_uuid();
  v_biz uuid := gen_random_uuid();  -- throwaway business account managed by v_t1
  v_member uuid := gen_random_uuid();
  v_outsider uuid := gen_random_uuid();
  v_owner3 uuid := gen_random_uuid();
  v_cat uuid := gen_random_uuid();
  v_ok boolean;
  v_banned timestamptz;
  v_count integer;
  v_state text;
  v_fn text;
  v_role text;
  v_user uuid;
  v_personal uuid := gen_random_uuid();  -- personal account (no managing tenant)
  v_tok text := pg_catalog.md5(gen_random_uuid()::text) || pg_catalog.md5(gen_random_uuid()::text);
BEGIN
  RAISE NOTICE 'Running as % (session_user %)', current_user, session_user;

  -- Setup: throwaway tenants, users and memberships. core.users rows come from the auth.users trigger.
  FOREACH v_user IN ARRAY ARRAY[v_owner, v_biz, v_member, v_outsider, v_owner3, v_personal] LOOP
    INSERT INTO auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
    VALUES (
      v_user, 'authenticated', 'authenticated', 'smoke-' || v_user || '@example.invalid',
      CASE WHEN v_user = v_biz
           THEN pg_catalog.jsonb_build_object('managed_by_tenant', v_t1::text)
           ELSE '{}'::jsonb END,
      '{}'::jsonb);
  END LOOP;
  INSERT INTO core.tenants (id, name, slug, contact_email, base_currency, status)
  VALUES (v_t1, 'smoke 1', 'smoke-' || v_t1, 'smoke@example.invalid', 'COP', 'active'),
         (v_t2, 'smoke 2', 'smoke-' || v_t2, 'smoke@example.invalid', 'COP', 'active'),
         (v_t3, 'smoke 3', 'smoke-' || v_t3, 'smoke@example.invalid', 'COP', 'active');
  INSERT INTO core.tenant_memberships (user_id, tenant_id, role, status)
  VALUES (v_owner, v_t1, 'OWNER', 'active'),
         (v_biz, v_t1, 'MEMBER', 'active'),
         (v_member, v_t1, 'MEMBER', 'active'),
         (v_owner3, v_t3, 'OWNER', 'active');

  -- 1. The role can write auth.users.banned_until.
  BEGIN
    UPDATE auth.users SET banned_until = now() + interval '1 day' WHERE id = v_biz;
    UPDATE auth.users SET banned_until = NULL WHERE id = v_biz;
    PERFORM pg_temp.smoke_report('1 update auth.users.banned_until', true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.smoke_report('1 update auth.users.banned_until', false, SQLSTATE || ' ' || SQLERRM);
  END;

  -- 2. The role can delete from auth.sessions and auth.refresh_tokens.
  BEGIN
    INSERT INTO auth.sessions (id, user_id) VALUES (gen_random_uuid(), v_biz);
    INSERT INTO auth.refresh_tokens (token, user_id) VALUES ('smoke-' || gen_random_uuid(), v_biz::text);
    DELETE FROM auth.refresh_tokens WHERE user_id = v_biz::text;
    DELETE FROM auth.sessions WHERE user_id = v_biz;
    PERFORM pg_temp.smoke_report('2 delete auth.sessions and auth.refresh_tokens', true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.smoke_report('2 delete auth.sessions and auth.refresh_tokens', false, SQLSTATE || ' ' || SQLERRM);
  END;

  -- 3. Suspending the throwaway membership bans the account and drops its sessions (trigger path).
  BEGIN
    INSERT INTO auth.sessions (id, user_id) VALUES (gen_random_uuid(), v_biz);
    INSERT INTO auth.refresh_tokens (token, user_id) VALUES ('smoke-' || gen_random_uuid(), v_biz::text);
    UPDATE core.tenant_memberships SET status = 'suspended' WHERE user_id = v_biz AND tenant_id = v_t1;
    SELECT banned_until INTO v_banned FROM auth.users WHERE id = v_biz;
    SELECT count(*) INTO v_count FROM auth.sessions WHERE user_id = v_biz;
    PERFORM pg_temp.smoke_report(
      '3a suspending bans the account and removes sessions',
      v_banned IS NOT NULL AND v_banned > now() + interval '50 years' AND v_count = 0,
      'banned_until=' || COALESCE(v_banned::text, 'null') || ' sessions=' || v_count);

    -- 3b. The suspended managing membership keeps the ban (a business account can no longer hold a
    -- second membership: see check 10, so there is nothing else to lift it).
    SELECT banned_until INTO v_banned FROM auth.users WHERE id = v_biz;
    PERFORM pg_temp.smoke_report('3b a suspended managing membership keeps the ban', v_banned IS NOT NULL,
      'banned_until=' || COALESCE(v_banned::text, 'null'));

    -- 3c. Unsuspending clears the ban.
    UPDATE core.tenant_memberships SET status = 'active' WHERE user_id = v_biz AND tenant_id = v_t1;
    SELECT banned_until INTO v_banned FROM auth.users WHERE id = v_biz;
    PERFORM pg_temp.smoke_report('3c reactivating lifts the ban', v_banned IS NULL,
      'banned_until=' || COALESCE(v_banned::text, 'null'));
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.smoke_report('3 membership trigger path', false, SQLSTATE || ' ' || SQLERRM);
  END;

  -- 4. core.revoke_user_sessions removes sessions and tokens of a business account.
  BEGIN
    INSERT INTO auth.sessions (id, user_id) VALUES (gen_random_uuid(), v_biz);
    INSERT INTO auth.refresh_tokens (token, user_id) VALUES ('smoke-' || gen_random_uuid(), v_biz::text);
    PERFORM core.revoke_user_sessions(v_biz);
    SELECT (SELECT count(*) FROM auth.sessions WHERE user_id = v_biz)
         + (SELECT count(*) FROM auth.refresh_tokens WHERE user_id = v_biz::text) INTO v_count;
    PERFORM pg_temp.smoke_report('4a revoke_user_sessions clears sessions and refresh tokens', v_count = 0,
      'remaining=' || v_count);
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.smoke_report('4a revoke_user_sessions clears sessions and refresh tokens', false, SQLSTATE || ' ' || SQLERRM);
  END;
  -- 4b. ... and refuses an account that is not a business account.
  v_ok := false;
  BEGIN
    PERFORM core.revoke_user_sessions(v_member);
  EXCEPTION WHEN insufficient_privilege THEN
    v_ok := true;
  WHEN OTHERS THEN
    v_ok := false;
  END;
  PERFORM pg_temp.smoke_report('4b revoke_user_sessions refuses personal accounts', v_ok);

  -- 5. Last owner rules.
  v_ok := false;
  BEGIN
    DELETE FROM core.tenants WHERE id = v_t3;
    SELECT count(*) INTO v_count FROM core.tenant_memberships WHERE tenant_id = v_t3;
    v_ok := v_count = 0;
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.smoke_report('5a deleting a whole tenant cascades over its sole owner', false, SQLSTATE || ' ' || SQLERRM);
    v_ok := NULL;
  END;
  IF v_ok IS NOT NULL THEN
    PERFORM pg_temp.smoke_report('5a deleting a whole tenant cascades over its sole owner', v_ok);
  END IF;

  FOREACH v_fn IN ARRAY ARRAY[
    'delete the sole owner membership',
    'delete the auth user that is sole owner of an existing tenant',
    'suspend the sole active owner',
    'change the tenant of a membership'
  ] LOOP
    v_ok := false;
    BEGIN
      IF v_fn = 'delete the sole owner membership' THEN
        DELETE FROM core.tenant_memberships WHERE user_id = v_owner AND tenant_id = v_t1;
      ELSIF v_fn = 'delete the auth user that is sole owner of an existing tenant' THEN
        DELETE FROM auth.users WHERE id = v_owner;
      ELSIF v_fn = 'suspend the sole active owner' THEN
        UPDATE core.tenant_memberships SET status = 'suspended' WHERE user_id = v_owner AND tenant_id = v_t1;
      ELSE
        UPDATE core.tenant_memberships SET tenant_id = v_t2 WHERE user_id = v_member AND tenant_id = v_t1;
      END IF;
      v_ok := false;   -- reached only if nothing blocked it
    EXCEPTION WHEN OTHERS THEN
      v_ok := true;    -- blocked, as wanted (subtransaction rolled back)
    END;
    PERFORM pg_temp.smoke_report('5 blocked: ' || v_fn, v_ok);
  END LOOP;

  -- 6. A product can not reference a category of another tenant.
  v_ok := false;
  BEGIN
    INSERT INTO catalog.categories (id, name, tenant_id, description, status, slug)
    VALUES (v_cat, 'smoke', v_t1, 'smoke', 'active', 'smoke-' || v_cat);
    INSERT INTO catalog.products (id, name, price_cents, cost_cents, wholesale_price_cents, description,
                                  stock, category_id, status, sku, tenant_id)
    VALUES (gen_random_uuid(), 'smoke', 100, 50, 0, 'smoke', 1, v_cat, 'active', 'SMOKE1', v_t2);
    v_state := 'insert succeeded';
  EXCEPTION
    WHEN foreign_key_violation THEN v_ok := true; v_state := 'foreign_key_violation';
    WHEN OTHERS THEN v_ok := false; v_state := SQLSTATE || ' ' || SQLERRM;
  END;
  PERFORM pg_temp.smoke_report('6 cross tenant category rejected by the engine', v_ok, v_state);

  -- 7. Execute privileges. has_function_privilege covers direct grants and PUBLIC.
  FOREACH v_fn IN ARRAY ARRAY[
    'core.sync_business_account_access()',
    'core.revoke_user_sessions(uuid)',
    'core.check_last_owner()',
    'core.is_business_account(uuid, uuid)',
    'core.enforce_business_account_single_tenant()'
  ] LOOP
    FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      PERFORM pg_temp.smoke_report(
        '7 ' || v_role || ' can not execute ' || v_fn,
        NOT has_function_privilege(v_role, v_fn, 'EXECUTE'));
    END LOOP;
    PERFORM pg_temp.smoke_report(
      '7 postgres can execute ' || v_fn,
      has_function_privilege('postgres', v_fn, 'EXECUTE'));
  END LOOP;

  -- 8. An API role can not call the revoke function (real call, not only the catalog).
  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    v_ok := false;
    BEGIN
      EXECUTE format('SET LOCAL ROLE %I', v_role);
      PERFORM core.revoke_user_sessions(v_biz);
      v_ok := false;
    EXCEPTION WHEN insufficient_privilege THEN
      v_ok := true;
    WHEN OTHERS THEN
      v_ok := false;
    END;
    RESET ROLE;
    PERFORM pg_temp.smoke_report('8 ' || v_role || ' call to core.revoke_user_sessions is denied', v_ok);
  END LOOP;

  -- 9. An authenticated user can not escalate through memberships (self promotion, self insert).
  BEGIN
    PERFORM pg_catalog.set_config(
      'request.jwt.claims',
      pg_catalog.jsonb_build_object('sub', v_member::text, 'role', 'authenticated')::text, true);
    PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_member::text, true);
    BEGIN
      SET LOCAL ROLE authenticated;
      UPDATE core.tenant_memberships SET role = 'OWNER' WHERE user_id = v_member AND tenant_id = v_t1;
    EXCEPTION WHEN OTHERS THEN
      NULL;  -- denied by privilege, RLS or the guard trigger
    END;
    RESET ROLE;
    SELECT role::text INTO v_state FROM core.tenant_memberships WHERE user_id = v_member AND tenant_id = v_t1;
    PERFORM pg_temp.smoke_report('9a a MEMBER can not promote itself to OWNER', v_state = 'MEMBER', 'role=' || v_state);

    PERFORM pg_catalog.set_config(
      'request.jwt.claims',
      pg_catalog.jsonb_build_object('sub', v_outsider::text, 'role', 'authenticated')::text, true);
    PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_outsider::text, true);
    BEGIN
      SET LOCAL ROLE authenticated;
      INSERT INTO core.tenant_memberships (user_id, tenant_id, role, status) VALUES (v_outsider, v_t1, 'OWNER', 'active');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    RESET ROLE;
    SELECT count(*) INTO v_count FROM core.tenant_memberships WHERE user_id = v_outsider;
    PERFORM pg_temp.smoke_report('9b an outsider can not insert itself as OWNER', v_count = 0, 'rows=' || v_count);

    BEGIN
      SET LOCAL ROLE anon;
      INSERT INTO core.tenant_memberships (user_id, tenant_id, role, status) VALUES (v_outsider, v_t1, 'OWNER', 'active');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    RESET ROLE;
    SELECT count(*) INTO v_count FROM core.tenant_memberships WHERE user_id = v_outsider;
    PERFORM pg_temp.smoke_report('9c anon can not write memberships', v_count = 0, 'rows=' || v_count);
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    PERFORM pg_temp.smoke_report('9 membership escalation checks', false, SQLSTATE || ' ' || SQLERRM);
  END;

  -- 10. A business account belongs to ONE company (migration 20261103070000). Runs as the migration
  -- login, which is the strongest writer: the trigger must bind it too.
  -- 10a. Direct insert into another tenant (as postgres) is refused with P0004.
  v_ok := false;
  BEGIN
    INSERT INTO core.tenant_memberships (user_id, tenant_id, role, status) VALUES (v_biz, v_t2, 'MEMBER', 'active');
    v_state := 'insert succeeded';
  EXCEPTION
    WHEN SQLSTATE 'P0004' THEN v_ok := true; v_state := 'P0004';
    WHEN OTHERS THEN v_ok := false; v_state := SQLSTATE || ' ' || SQLERRM;
  END;
  PERFORM pg_temp.smoke_report('10a business account can not be inserted into a second tenant', v_ok, v_state);

  -- 10b. As the would-be OWNER of a brand new tenant (what onboarding does) it is refused too.
  v_ok := false;
  BEGIN
    INSERT INTO core.tenant_memberships (user_id, tenant_id, role, status) VALUES (v_biz, v_t2, 'OWNER', 'active');
    v_state := 'insert succeeded';
  EXCEPTION
    WHEN SQLSTATE 'P0004' THEN v_ok := true; v_state := 'P0004';
    WHEN OTHERS THEN v_ok := false; v_state := SQLSTATE || ' ' || SQLERRM;
  END;
  PERFORM pg_temp.smoke_report('10b business account can not own another tenant', v_ok, v_state);

  -- 10c. Moving its membership to another tenant is refused.
  v_ok := false;
  BEGIN
    UPDATE core.tenant_memberships SET tenant_id = v_t2 WHERE user_id = v_biz AND tenant_id = v_t1;
    v_state := 'update succeeded';
  EXCEPTION
    WHEN OTHERS THEN v_ok := true; v_state := SQLSTATE;
  END;
  PERFORM pg_temp.smoke_report('10c business account membership can not be moved to another tenant', v_ok, v_state);

  -- 10d. accept_invitation refuses it with P0004 (invitation of tenant 2, GENERATED_EMAIL or not).
  INSERT INTO core.tenant_roles (id, tenant_id, name, permissions)
  VALUES (gen_random_uuid(), v_t2, 'smoke role', ARRAY['VIEW_ORDERS']);
  INSERT INTO core.tenant_invitations (tenant_id, role_id, token_hash, expires_at, max_uses, use_count,
                                       account_mode, created_by)
  SELECT v_t2, r.id, v_tok, now() + interval '1 day', 5, 0, 'REAL_EMAIL', v_owner
  FROM core.tenant_roles r WHERE r.tenant_id = v_t2 AND r.name = 'smoke role';
  v_ok := false;
  BEGIN
    PERFORM * FROM core.accept_invitation(v_tok, v_biz, false, NULL, NULL, NULL);
    v_state := 'accepted';
  EXCEPTION
    WHEN SQLSTATE 'P0004' THEN v_ok := true; v_state := 'P0004';
    WHEN OTHERS THEN v_ok := false; v_state := SQLSTATE || ' ' || SQLERRM;
  END;
  PERFORM pg_temp.smoke_report('10d accept_invitation refuses a business account of another tenant', v_ok, v_state);

  -- 10e. Re-linking to its OWN tenant after an unlink still works.
  v_ok := false;
  BEGIN
    DELETE FROM core.tenant_memberships WHERE user_id = v_biz AND tenant_id = v_t1;
    INSERT INTO core.tenant_memberships (user_id, tenant_id, role, status) VALUES (v_biz, v_t1, 'MEMBER', 'active');
    v_ok := true; v_state := 'relinked';
  EXCEPTION WHEN OTHERS THEN
    v_ok := false; v_state := SQLSTATE || ' ' || SQLERRM;
  END;
  PERFORM pg_temp.smoke_report('10e business account can be re-linked to its own tenant', v_ok, v_state);

  -- 10f. A personal account may join two tenants.
  v_ok := false;
  BEGIN
    INSERT INTO core.tenant_memberships (user_id, tenant_id, role, status)
    VALUES (v_personal, v_t1, 'MEMBER', 'active'), (v_personal, v_t2, 'MEMBER', 'active');
    v_ok := true; v_state := 'two memberships';
  EXCEPTION WHEN OTHERS THEN
    v_ok := false; v_state := SQLSTATE || ' ' || SQLERRM;
  END;
  PERFORM pg_temp.smoke_report('10f personal account can join two tenants', v_ok, v_state);

  RAISE NOTICE 'SMOKE SUMMARY: % failure(s)',
    COALESCE(NULLIF(pg_catalog.current_setting('smoke.failures', true), ''), '0');
END;
$$;

ROLLBACK;

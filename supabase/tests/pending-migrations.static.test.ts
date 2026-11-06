import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ORDER_NOTIFICATION_EVENT_TYPES } from '@/notifications/application/notification-events';
import { KIVI_PRODUCT_EVENT_TYPES } from '@/kivi/application/kivi-events';

const BASELINE_VERSION = '20261014000000';
const SEED_TABLES: Readonly<Record<string, readonly string[]>> = {
  '20261105000000_order_status_history.sql': ['sales.order_status_history'],
  '20261020000000_kivi_connections.sql': ['core.outbox_relay_routes'],
  '20261019000000_store_branding_storage.sql': ['storage.buckets'],
  '20261018183618_seller_order_delivery_notifications.sql': ['core.outbox_relay_routes'],
  '20261015000000_rabbitmq_outbox_relay.sql': [
    'core.outbox_relay_exclusions',
    'core.outbox_relay_routes',
  ],
  '20261015001000_notification_outbox_routing.sql': ['core.outbox_relay_routes'],
  '20261015180647_payments_v41_checkout_and_inbox.sql': [
    'core.system_flags',
    'sales.order_automation_exclusions',
  ],
  '20261015200320_payments_v41_order_expiry_domain_support.sql': ['core.outbox_relay_routes'],
  '20261016040030_payments_v41_administrative_dual_control.sql': ['storage.buckets'],
  '20261016041424_payments_v41_retention_and_financial_fencing.sql': ['core.outbox_relay_routes'],
};
const MIGRATIONS_DIR =
  process.env.PENDING_MIGRATIONS_DIR ?? path.join(process.cwd(), 'supabase', 'migrations');
const FILE_PATTERN = /^\d{14}_[a-z0-9_]+\.sql$/;

interface PendingMigration {
  name: string;
  sql: string;
}

interface FunctionDefinition {
  name: string;
  header: string;
  body: string;
}

function loadPendingMigrations(): PendingMigration[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter(
      (name: string): boolean => name.endsWith('.sql') && name.slice(0, 14) > BASELINE_VERSION,
    )
    .sort()
    .map((name: string): PendingMigration => ({
      name,
      sql: readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8').replace(/--[^\n]*/g, ''),
    }));
}

function functionsOf(sql: string): FunctionDefinition[] {
  const pattern =
    /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([\w.]+)\s*\(([\s\S]*?)\bAS\s+\$\$([\s\S]*?)\$\$/gi;
  return Array.from(sql.matchAll(pattern)).map((match: RegExpMatchArray): FunctionDefinition => ({
    name: match[1],
    header: match[2],
    body: match[3],
  }));
}

function withoutDollarQuotedBlocks(sql: string): string {
  return sql.replace(/\$\$[\s\S]*?\$\$/g, '');
}

const pending = loadPendingMigrations();

describe('pending migrations (static checks)', (): void => {
  it('finds pending migrations after the applied baseline', (): void => {
    expect(pending.length).toBeGreaterThan(0);
    for (const migration of pending) expect(migration.name).toMatch(FILE_PATTERN);
  });

  it.each(pending.map((m: PendingMigration): [string, string] => [m.name, m.sql]))(
    '%s never calls the nonexistent has_role function',
    (_name: string, sql: string): void => {
      expect(sql).not.toMatch(/(?<![A-Za-z_])has_role\s*\(/);
    },
  );

  it.each(pending.map((m: PendingMigration): [string, string] => [m.name, m.sql]))(
    '%s gives every SECURITY DEFINER function a fixed search_path',
    (_name: string, sql: string): void => {
      for (const fn of functionsOf(sql)) {
        if (/SECURITY\s+DEFINER/i.test(fn.header)) {
          expect(fn.header, fn.name).toMatch(/SET\s+search_path\s*=/i);
        }
      }
    },
  );

  it.each(pending.map((m: PendingMigration): [string, string] => [m.name, m.sql]))(
    '%s revokes and grants execute explicitly on every function it defines',
    (_name: string, sql: string): void => {
      for (const fn of functionsOf(sql)) {
        const escaped = fn.name.replace('.', '\\.');
        expect(sql, `${fn.name} revoke`).toMatch(
          new RegExp(`REVOKE\\s+ALL\\s+ON\\s+FUNCTION\\s+${escaped}\\s*\\(`, 'i'),
        );
        expect(sql, `${fn.name} grant`).toMatch(
          new RegExp(`GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+${escaped}\\s*\\(`, 'i'),
        );
      }
    },
  );

  it.each(pending.map((m: PendingMigration): [string, string] => [m.name, m.sql]))(
    '%s closes every new table to anon, authenticated and service_role and enables RLS',
    (_name: string, sql: string): void => {
      for (const match of sql.matchAll(
        /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?((?:core|sales|catalog)\.\w+)/gi,
      )) {
        const table = match[1];
        const escaped = table.replace('.', '\\.');
        expect(sql, `${table} rls`).toMatch(
          new RegExp(`ALTER\\s+TABLE\\s+${escaped}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i'),
        );
        const revoke = sql.match(
          new RegExp(`REVOKE\\s+ALL\\s+ON\\s+${escaped}\\s+FROM\\s+([^;]+);`, 'i'),
        );
        expect(revoke, `${table} revoke`).not.toBeNull();
        for (const role of ['anon', 'authenticated', 'service_role']) {
          expect(revoke?.[1], `${table} ${role}`).toMatch(new RegExp(`\\b${role}\\b`, 'i'));
        }
      }
    },
  );

  it.each(pending.map((m: PendingMigration): [string, string] => [m.name, m.sql]))(
    '%s revokes every temporary schema CREATE and membership grant it makes',
    (_name: string, sql: string): void => {
      for (const match of sql.matchAll(
        /GRANT\s+[^;]*?\bCREATE\b[^;]*?\s+ON\s+SCHEMA\s+(\w+)\s+TO\s+(\w+)/gi,
      )) {
        expect(sql, `${match[1]} ${match[2]}`).toMatch(
          new RegExp(`REVOKE\\s+CREATE\\s+ON\\s+SCHEMA\\s+${match[1]}\\s+FROM\\s+${match[2]}`, 'i'),
        );
      }
      for (const match of sql.matchAll(/GRANT\s+(\w+)\s+TO\s+current_user/gi)) {
        expect(sql, match[1]).toMatch(
          new RegExp(`REVOKE\\s+${match[1]}\\s+FROM\\s+current_user`, 'i'),
        );
      }
    },
  );

  it.each(pending.map((m: PendingMigration): [string, string] => [m.name, m.sql]))(
    '%s never grants to anon, authenticated, service_role or PUBLIC and never grants privileged attributes',
    (name: string, sql: string): void => {
      for (const match of sql.matchAll(/\bGRANT\b[^;]*?\bTO\b\s+([^;]+);/gi)) {
        if (
          name === '20261106014558_monetary_invariants_and_currency.sql' &&
          /^GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.get_public_(products_by_slug|product_by_id)_v2\([^;]+\)\s+TO\s+anon,\s*authenticated;$/i.test(
            match[0],
          )
        )
          continue;
        if (
          /^GRANT\s+SELECT\s+ON\s+sales\.(refund_operations|compensation_obligations)\s+TO\s+authenticated;$/i.test(
            match[0],
          )
        ) {
          expect(sql).toMatch(
            /FOR\s+SELECT\s+TO\s+authenticated\s+USING\s*\(\(SELECT\s+core\.user_has_access_to_tenant\(tenant_id\)\)\)/i,
          );
          continue;
        }
        if (name === '20261107000002_security_authorization_boundaries.sql') {
          const grant = match[0].match(
            /^GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+([a-z_.]+)\(([^)]*)\)\s+TO\s+authenticated;$/i,
          );
          const allowed = new Set([
            'public.upsert_tenant_transactional(jsonb)',
            'public.upsert_user_transactional(jsonb)',
            'core.onboard_tenant_transactional(uuid,uuid,jsonb,jsonb)',
            'core.current_member_has_permission(uuid,text[])',
          ]);
          if (grant && allowed.has(`${grant[1]}(${grant[2].replace(/\s/g, '')})`)) {
            const fn = functionsOf(sql).find((definition): boolean => definition.name === grant[1]);
            expect(fn?.body, 'browser-callable definers must bind the actor').toMatch(
              /auth\.uid\(\)/,
            );
            continue;
          }
        }
        expect(match[1]).not.toMatch(/\b(anon|authenticated|service_role|public)\b/i);
      }
      expect(sql).not.toMatch(/(?<![A-Za-z])(SUPERUSER|BYPASSRLS|REPLICATION)\b/);
    },
  );

  it.each(pending.map((m: PendingMigration): [string, string] => [m.name, m.sql]))(
    '%s contains no destructive statement and only the allowed top-level data insert',
    (name: string, sql: string): void => {
      const topLevel = withoutDollarQuotedBlocks(sql);
      expect(topLevel).not.toMatch(
        /(?:^|;)\s*(DELETE\s+FROM|TRUNCATE|DROP\s+(TABLE|SCHEMA|ROLE|FUNCTION))\b/i,
      );
      // Match statement starts, not the UPDATE keyword in a CREATE POLICY ... FOR UPDATE TO.
      for (const match of topLevel.matchAll(/(?:^|;)\s*(INSERT\s+INTO|UPDATE)\s+([\w.]+)/gi)) {
        if (
          name === '20261106014558_monetary_invariants_and_currency.sql' &&
          match[1].toUpperCase() === 'UPDATE' &&
          match[2] === 'sales.orders'
        ) {
          expect(topLevel).toMatch(/UPDATE sales\.orders o SET currency = coalesce\(/);
          expect(topLevel).toMatch(/WHERE t\.id = o\.tenant_id AND o\.currency IS NULL/);
          continue;
        }
        expect(match[1].toUpperCase()).toBe('INSERT INTO');
        expect(SEED_TABLES[name] ?? []).toContain(match[2]);
      }
    },
  );

  it.each(pending.map((m: PendingMigration): [string, string] => [m.name, m.sql]))(
    '%s makes every outbox claim honour the relay exclusions and the worker routes',
    (_name: string, sql: string): void => {
      for (const fn of functionsOf(sql)) {
        if (
          /core\.outbox_events/.test(fn.body) &&
          /SET\s+status\s*=\s*'PROCESSING'/i.test(fn.body)
        ) {
          expect(fn.body, fn.name).toMatch(/outbox_relay_exclusions/);
        }
        if (
          /UPDATE\s+core\.outbox_events\b[^;]*?\bSET\s+status\s*=\s*'PROCESSING'/i.test(fn.body)
        ) {
          expect(fn.body, fn.name).toMatch(/outbox_relay_exclusions/);
          expect(fn.body, fn.name).toMatch(/outbox_relay_routes/);
        }
      }
    },
  );

  it.each(pending.map((m: PendingMigration): [string, string] => [m.name, m.sql]))(
    '%s authorizes routes by the session login, never by the definer',
    (_name: string, sql: string): void => {
      for (const fn of functionsOf(sql)) {
        if (/outbox_relay_routes/.test(fn.body)) {
          expect(fn.body, fn.name).toMatch(
            /pg_catalog\.pg_has_role\(\s*session_user\s*,\s*\w+\.oid\s*,\s*'MEMBER'\s*\)/i,
          );
          expect(fn.body, fn.name).not.toMatch(/\bcurrent_user\b/i);
        }
      }
    },
  );

  it.each(pending.map((m: PendingMigration): [string, string] => [m.name, m.sql]))(
    '%s rejects unrouted event types before touching any outbox row',
    (_name: string, sql: string): void => {
      for (const fn of functionsOf(sql)) {
        const rejection = fn.body.search(/not permitted for this worker/i);
        if (rejection < 0) continue;
        expect(fn.body.slice(rejection), fn.name).toMatch(/ERRCODE\s*=\s*'42501'/i);
        const firstUpdate = fn.body.search(/\bUPDATE\s+core\.outbox_events\b/i);
        expect(firstUpdate, fn.name).toBeGreaterThan(rejection);
      }
    },
  );

  it.each(pending.map((m: PendingMigration): [string, string] => [m.name, m.sql]))(
    '%s scopes every outbox update not fenced by the worker token to permitted routes',
    (_name: string, sql: string): void => {
      for (const fn of functionsOf(sql)) {
        if (/not permitted for this worker/i.test(fn.body)) continue;
        for (const statement of fn.body.match(/\bUPDATE\s+core\.outbox_events\b[^;]*/gi) ?? []) {
          const where = statement.slice(Math.max(statement.search(/\bWHERE\b/i), 0));
          if (/\blocked_by\s*=\s*p_worker_token\b/i.test(where)) continue;
          expect(statement, fn.name).toMatch(/outbox_relay_routes/);
          expect(statement, fn.name).toMatch(/outbox_relay_exclusions/);
        }
      }
    },
  );

  it('recognises both outbox claim functions as PROCESSING claims', (): void => {
    const claims = pending
      .flatMap((m: PendingMigration): FunctionDefinition[] => functionsOf(m.sql))
      .filter((fn: FunctionDefinition): boolean =>
        /UPDATE\s+core\.outbox_events\b[^;]*?\bSET\s+status\s*=\s*'PROCESSING'/i.test(fn.body),
      )
      .map((fn: FunctionDefinition): string => fn.name);
    expect(claims).toEqual(
      expect.arrayContaining(['core.claim_outbox_events', 'core.claim_outbox_event_by_type']),
    );
  });

  it('creates the routes table before any statement that references it', (): void => {
    const all = pending.map((m: PendingMigration): string => m.sql).join('\n');
    const creation = all.search(/CREATE\s+TABLE\s+core\.outbox_relay_routes\b/i);
    expect(creation).toBeGreaterThanOrEqual(0);
    expect(all.search(/outbox_relay_routes/)).toBeGreaterThanOrEqual(creation);
  });

  it('seeds exactly the order notification routes for outbox_worker_role and the Kivi product routes', (): void => {
    const seeded: string[] = [];
    for (const migration of pending) {
      const topLevel = withoutDollarQuotedBlocks(migration.sql);
      for (const insert of topLevel.matchAll(
        /INSERT\s+INTO\s+core\.outbox_relay_routes\b([^;]*);/gi,
      )) {
        expect(insert[1], migration.name).not.toMatch(/\bSELECT\b/i);
        for (const row of insert[1].matchAll(/\(\s*'(\w+)'\s*,\s*'(\w+)'\s*,\s*'(\w+)'\s*\)/g)) {
          seeded.push(`${row[1]}/${row[2]}/${row[3]}`);
        }
      }
    }
    const expected = ORDER_NOTIFICATION_EVENT_TYPES.map(
      (eventType: string): string => `outbox_worker_role/Order/${eventType}`,
    );
    const kivi = KIVI_PRODUCT_EVENT_TYPES.map(
      (eventType: string): string => `kivi_sync_worker_role/Product/${eventType}`,
    );
    expect([...seeded].sort()).toEqual([...expected, ...kivi].sort());
    expect(expected).toHaveLength(6);
    expect(kivi).toHaveLength(5);
  });
});

describe('user management migration (demographic consent)', (): void => {
  const migration = pending.find((m: PendingMigration): boolean =>
    m.name.endsWith('_user_management.sql'),
  );
  const fn = (name: string): FunctionDefinition | undefined =>
    functionsOf(migration?.sql ?? '').find((f: FunctionDefinition): boolean => f.name === name);

  it('accept_invitation never downgrades the global consent flag', (): void => {
    const body = fn('core.accept_invitation')?.body ?? '';
    expect(body).not.toMatch(/demographic_consent\s*=\s*COALESCE\s*\(\s*p_consent/i);
    expect(body).not.toMatch(/demographic_consent\s*=\s*(false|CASE)/i);
    expect(body).toMatch(/demographic_consent\s*=\s*true/i);
    expect(body).toMatch(/NOT\s+demographic_consent/i);
  });

  it('record_signup_demographics only stores an unlinked sample when consent is given', (): void => {
    const definition = fn('core.record_signup_demographics');
    expect(definition, 'function exists').toBeDefined();
    expect(definition?.header).toMatch(/SECURITY\s+DEFINER/i);
    const body = definition?.body ?? '';
    const insert = body.search(/INSERT\s+INTO\s+analytics\.demographic_samples/i);
    expect(insert).toBeGreaterThan(
      body.search(/IF\s+COALESCE\s*\(\s*p_consent\s*,\s*false\s*\)\s+THEN/i),
    );
    const statement = body.slice(insert).match(/INSERT[\s\S]*?;/i)?.[0] ?? '';
    expect(statement).not.toMatch(/user_id|email/i);
    expect(statement).toMatch(/date_trunc\(\s*'month'/i);
    expect(body).not.toMatch(/demographic_consent\s*=\s*false/i);
    expect(sqlGrantsTo(migration?.sql ?? '', 'core.record_signup_demographics')).toBe('postgres');
  });
});

function sqlGrantsTo(sql: string, name: string): string | null {
  const escaped = name.replace('.', String.raw`\.`);
  const pattern = String.raw`GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+${escaped}\s*\([^)]*\)\s+TO\s+(\w+)`;
  const match = sql.match(new RegExp(pattern, 'i'));
  return match ? match[1] : null;
}

describe('invitation account mode migration', (): void => {
  const migration = pending.find((m: PendingMigration): boolean =>
    m.name.endsWith('_invitation_account_mode.sql'),
  );

  it('adds a constrained account_mode column defaulting to generated emails', (): void => {
    const sql = migration?.sql ?? '';
    expect(migration, 'migration exists').toBeDefined();
    expect(sql).toMatch(/ALTER\s+TABLE\s+core\.tenant_invitations/i);
    expect(sql).toMatch(/account_mode\s+text\s+NOT\s+NULL\s+DEFAULT\s+'GENERATED_EMAIL'/i);
    expect(sql).toMatch(
      /CHECK\s*\(\s*account_mode\s+IN\s*\(\s*'GENERATED_EMAIL'\s*,\s*'REAL_EMAIL'\s*,\s*'GOOGLE'\s*\)\s*\)/i,
    );
  });

  it('does not redefine accept_invitation or touch grants', (): void => {
    const sql = migration?.sql ?? '';
    expect(sql).not.toMatch(/FUNCTION/i);
    expect(sql).not.toMatch(/\bGRANT\b/i);
  });
});

describe('member account management migration', (): void => {
  const migration = pending.find((m: PendingMigration): boolean =>
    m.name.endsWith('_member_account_management.sql'),
  );
  const sql = migration?.sql ?? '';
  const fn = (name: string): FunctionDefinition | undefined =>
    functionsOf(sql).find((f: FunctionDefinition): boolean => f.name === name);
  const acceptBody = fn('core.accept_invitation')?.body ?? '';

  it('exists and is ordered after the invitation account mode migration', (): void => {
    expect(migration, 'migration exists').toBeDefined();
    expect(migration?.name ?? '').toBe('20261103040000_member_account_management.sql');
  });

  it('adds a nullable managed_by_tenant_id referencing tenants with ON DELETE SET NULL', (): void => {
    expect(sql).toMatch(/ALTER\s+TABLE\s+core\.users/i);
    expect(sql).toMatch(
      /managed_by_tenant_id\s+uuid\s+NULL\s+REFERENCES\s+core\.tenants\s*\(\s*id\s*\)\s+ON\s+DELETE\s+SET\s+NULL/i,
    );
  });

  it('redefines accept_invitation with the same signature and grants only postgres', (): void => {
    const definition = fn('core.accept_invitation');
    expect(definition, 'function exists').toBeDefined();
    expect(definition?.header).toMatch(/SECURITY\s+DEFINER/i);
    expect(definition?.header).toMatch(
      /p_token_hash\s+text,\s*p_user_id\s+uuid,\s*p_consent\s+boolean,\s*p_age_range\s+text,\s*p_gender\s+text,\s*p_province\s+text,\s*p_first_name\s+text\s+DEFAULT\s+NULL,\s*p_last_name\s+text\s+DEFAULT\s+NULL/i,
    );
    expect(sqlGrantsTo(sql, 'core.accept_invitation')).toBe('postgres');
    expect(sql).toMatch(
      /REVOKE\s+ALL\s+ON\s+FUNCTION\s+core\.accept_invitation\(text, uuid, boolean, text, text, text, text, text\)\s+FROM\s+PUBLIC,\s*anon,\s*authenticated,\s*service_role/i,
    );
  });

  it('keeps every prior accept_invitation behaviour', (): void => {
    expect(acceptBody).toMatch(/Invitation not usable/);
    expect(acceptBody).toMatch(/Already a member/);
    expect(acceptBody).toMatch(/Unknown user/);
    expect(acceptBody).toMatch(/use_count\s*=\s*use_count\s*\+\s*1/i);
    expect(acceptBody).toMatch(/INSERT\s+INTO\s+analytics\.demographic_samples/i);
    expect(acceptBody).not.toMatch(/demographic_consent\s*=\s*COALESCE\s*\(\s*p_consent/i);
    expect(acceptBody).not.toMatch(/demographic_consent\s*=\s*(false|CASE)/i);
    expect(acceptBody).toMatch(/demographic_consent\s*=\s*true/i);
    expect(acceptBody).toMatch(/NOT\s+demographic_consent/i);
  });

  it('marks ownership only for GENERATED_EMAIL invitations on accounts created by this flow', (): void => {
    expect(acceptBody).toMatch(/account_mode\s*=\s*'GENERATED_EMAIL'/i);
    // Never take over an existing personal account: no membership anywhere, no previous owner,
    // a fresh account and a non deliverable generated login address.
    expect(acceptBody).toMatch(/NOT\s+EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+core\.tenant_memberships/i);
    expect(acceptBody).toMatch(/managed_by_tenant_id\s+IS\s+NULL/i);
    expect(acceptBody).toMatch(/\.staff\.invalid/);
    expect(acceptBody).toMatch(/created_at\s*>/i);
    const update = acceptBody.match(
      /UPDATE\s+core\.users\s+SET\s+managed_by_tenant_id[\s\S]*?;/i,
    )?.[0];
    expect(update, 'sets managed_by_tenant_id').toBeDefined();
    expect(update).toMatch(/managed_by_tenant_id\s+IS\s+NULL/i);
    expect(update).toMatch(/v_inv\.tenant_id/);
  });

  it('prevents API roles from writing managed_by_tenant_id', (): void => {
    const guard = functionsOf(sql).find((f: FunctionDefinition): boolean =>
      /managed_by_tenant_id/.test(f.body),
    );
    expect(sql).toMatch(/CREATE\s+TRIGGER\s+\w+[\s\S]*?ON\s+core\.users/i);
    const guarded = functionsOf(sql).find((f: FunctionDefinition): boolean =>
      /IS\s+DISTINCT\s+FROM\s+OLD\.managed_by_tenant_id/i.test(f.body),
    );
    expect(guarded, 'guard function').toBeDefined();
    expect(guarded?.body).toMatch(/authenticated/);
    expect(guarded?.body).toMatch(/anon/);
    expect(guard).toBeDefined();
  });
});

describe('membership hardening migration', (): void => {
  const migration = pending.find((m: PendingMigration): boolean =>
    m.name.endsWith('_membership_hardening.sql'),
  );
  const sql = migration?.sql ?? '';
  const fn = (name: string): FunctionDefinition | undefined =>
    functionsOf(sql).find((f: FunctionDefinition): boolean => f.name === name);
  const policy = (verb: string): string =>
    sql.match(
      new RegExp(
        `CREATE\\s+POLICY\\s+"OWNER and ADMIN can ${verb} memberships"[\\s\\S]*?;\\s*(?=DROP|CREATE|COMMIT|$)`,
        'i',
      ),
    )?.[0] ?? '';

  it('exists after the member account management migration', (): void => {
    expect(migration?.name).toBe('20261103050000_membership_hardening.sql');
  });

  it('gives every function it defines a postgres-only grant', (): void => {
    for (const name of [
      'core.is_business_account',
      'core.accept_invitation',
      'core.check_last_owner',
      'core.guard_membership_write',
      'core.sync_business_account_access',
    ]) {
      expect(fn(name), name).toBeDefined();
      expect(sqlGrantsTo(sql, name), name).toBe('postgres');
    }
  });

  describe('H1 membership writes', (): void => {
    it('replaces the three write policies so ADMIN is limited to other MEMBER rows of its tenant', (): void => {
      for (const verb of ['insert', 'update', 'delete']) {
        expect(sql).toMatch(
          new RegExp(
            `DROP\\s+POLICY\\s+IF\\s+EXISTS\\s+"OWNER and ADMIN can ${verb} memberships"`,
            'i',
          ),
        );
        const body = policy(verb);
        expect(body, verb).not.toBe('');
        expect(body, verb).not.toMatch(/ARRAY\s*\[\s*'OWNER'\s*,\s*'ADMIN'\s*\]/i);
        expect(body, verb).toMatch(/user_has_role_in_tenant\(\s*tenant_id\s*,\s*ARRAY\['OWNER'\]/i);
        expect(body, verb).toMatch(/user_has_role_in_tenant\(\s*tenant_id\s*,\s*ARRAY\['ADMIN'\]/i);
        expect(body, verb).toMatch(/role\s*=\s*'MEMBER'/i);
        expect(body, verb).toMatch(/user_id\s*<>\s*\(SELECT\s+auth\.uid\(\)\)/i);
      }
      expect(policy('update')).toMatch(/\bWITH\s+CHECK\b/i);
    });

    it('guards every membership write with a BEFORE trigger that only acts for API roles', (): void => {
      expect(sql).toMatch(
        /CREATE\s+TRIGGER\s+guard_membership_write\s+BEFORE\s+INSERT\s+OR\s+UPDATE\s+OR\s+DELETE\s+ON\s+core\.tenant_memberships/i,
      );
      const guard = fn('core.guard_membership_write');
      expect(guard?.header).toMatch(/SET\s+search_path\s*=\s*pg_catalog,\s*pg_temp/i);
      expect(guard?.header).not.toMatch(/SECURITY\s+DEFINER/i);
      const body = guard?.body ?? '';
      expect(body).toMatch(/current_user\s+NOT\s+IN\s*\(\s*'authenticated'\s*,\s*'anon'\s*\)/i);
      expect(body).toMatch(/auth\.uid\(\)/);
      expect(body).toMatch(/NEW\.tenant_id\s+IS\s+DISTINCT\s+FROM\s+OLD\.tenant_id/i);
      expect(body).toMatch(/core\.user_has_role_in_tenant\(\s*v_tenant\s*,\s*ARRAY\['OWNER'\]/i);
      expect(body).toMatch(/core\.user_has_role_in_tenant\(\s*v_tenant\s*,\s*ARRAY\['ADMIN'\]/i);
      expect(body).toMatch(/NEW\.role\s*<>\s*'MEMBER'/i);
      expect(body).toMatch(/OLD\.role\s*<>\s*'MEMBER'/i);
      expect(body).toMatch(/NEW\.user_id\s*=\s*v_actor/i);
      expect(body).toMatch(/OLD\.user_id\s*=\s*v_actor/i);
      expect(body).toMatch(/ERRCODE\s*=\s*'42501'/i);
    });

    it('keeps the last owner invariant and fixes its BEFORE DELETE return value', (): void => {
      const body = fn('core.check_last_owner')?.body ?? '';
      expect(body).toMatch(/RETURN\s+OLD/i);
      expect(body).toMatch(/último OWNER/);
      expect(sql).toMatch(
        /CREATE\s+TRIGGER\s+prevent_last_owner_removal\s+BEFORE\s+DELETE\s+OR\s+UPDATE\s+ON\s+core\.tenant_memberships/i,
      );
    });

    it('forces a custom role to belong to the membership tenant', (): void => {
      expect(sql).toMatch(
        /FOREIGN\s+KEY\s*\(\s*custom_role_id\s*,\s*tenant_id\s*\)\s+REFERENCES\s+core\.tenant_roles\s*\(\s*id\s*,\s*tenant_id\s*\)/i,
      );
      expect(sql).toMatch(/UNIQUE\s*\(\s*id\s*,\s*tenant_id\s*\)/i);
    });
  });

  describe('H4 central business rule', (): void => {
    it('defines is_business_account over auth app_metadata and core.users', (): void => {
      const definition = fn('core.is_business_account');
      expect(definition?.header).toMatch(
        /p_user_id\s+uuid,\s*p_tenant_id\s+uuid\s+DEFAULT\s+NULL\s*\)\s*RETURNS\s+boolean/i,
      );
      expect(definition?.header).toMatch(/\bSTABLE\b/i);
      expect(definition?.header).toMatch(/SECURITY\s+DEFINER/i);
      expect(definition?.header).toMatch(/SET\s+search_path\s*=\s*pg_catalog,\s*pg_temp/i);
      expect(definition?.body).toMatch(/raw_app_meta_data\s*->>\s*'managed_by_tenant'/i);
      expect(definition?.body).toMatch(/managed_by_tenant_id/i);
    });

    it('decides ownership in accept_invitation through that function and keeps its contract', (): void => {
      const definition = fn('core.accept_invitation');
      const body = definition?.body ?? '';
      expect(definition?.header).toMatch(
        /p_token_hash\s+text,\s*p_user_id\s+uuid,\s*p_consent\s+boolean,\s*p_age_range\s+text,\s*p_gender\s+text,\s*p_province\s+text,\s*p_first_name\s+text\s+DEFAULT\s+NULL,\s*p_last_name\s+text\s+DEFAULT\s+NULL/i,
      );
      expect(body).toMatch(/account_mode\s*=\s*'GENERATED_EMAIL'/i);
      expect(body).toMatch(/core\.is_business_account\(\s*p_user_id\s*,\s*v_inv\.tenant_id\s*\)/i);
      for (const kept of ['Invitation not usable', 'Already a member', 'Unknown user']) {
        expect(body).toContain(kept);
      }
      expect(body).toMatch(/use_count\s*=\s*use_count\s*\+\s*1/i);
      expect(body).toMatch(/INSERT\s+INTO\s+analytics\.demographic_samples/i);
      expect(body).toMatch(/NOT\s+demographic_consent/i);
      expect(sql).toMatch(
        /REVOKE\s+ALL\s+ON\s+FUNCTION\s+core\.accept_invitation\(text, uuid, boolean, text, text, text, text, text\)\s+FROM\s+PUBLIC,\s*anon,\s*authenticated,\s*service_role/i,
      );
    });

    it('does not depend on the generated email suffix or the one hour window in the effective SQL', (): void => {
      expect(sql).not.toMatch(/staff\.invalid/i);
      expect(sql).not.toMatch(/\bLIKE\b/i);
      expect(sql).not.toMatch(/interval\s+'1\s+hour'/i);
      const latest = new Map<string, string>();
      for (const m of pending) {
        for (const f of functionsOf(m.sql)) latest.set(f.name, f.body);
      }
      for (const [name, body] of latest) {
        expect(body, name).not.toMatch(/staff\.invalid/i);
      }
    });
  });

  describe('H3 deactivation sync', (): void => {
    const body = (): string => fn('core.sync_business_account_access')?.body ?? '';

    it('is a pinned SECURITY DEFINER function wired to status updates and deletes', (): void => {
      const definition = fn('core.sync_business_account_access');
      expect(definition?.header).toMatch(/SECURITY\s+DEFINER/i);
      expect(definition?.header).toMatch(/SET\s+search_path\s*=\s*pg_catalog,\s*pg_temp/i);
      expect(sql).toMatch(
        /CREATE\s+TRIGGER\s+\w+\s+AFTER\s+UPDATE\s+OF\s+status\s+ON\s+core\.tenant_memberships[\s\S]*?EXECUTE\s+FUNCTION\s+core\.sync_business_account_access\(\)/i,
      );
      expect(sql).toMatch(
        /CREATE\s+TRIGGER\s+\w+\s+AFTER\s+DELETE\s+ON\s+core\.tenant_memberships[\s\S]*?EXECUTE\s+FUNCTION\s+core\.sync_business_account_access\(\)/i,
      );
    });

    it('only touches business accounts without another active membership', (): void => {
      expect(body()).toMatch(/NOT\s+core\.is_business_account\(\s*v_user\s*\)/i);
      expect(body()).toMatch(
        /m\.user_id\s*=\s*v_user\s+AND\s+m\.tenant_id\s*<>\s*v_tenant\s+AND\s+m\.status\s*=\s*'active'/i,
      );
    });

    it('bans and revokes sessions on suspension or unlink, and clears the ban on reactivation', (): void => {
      expect(body()).toMatch(
        /SET\s+banned_until\s*=\s*pg_catalog\.now\(\)\s*\+\s*interval\s+'100 years'/i,
      );
      expect(body()).toMatch(/DELETE\s+FROM\s+auth\.refresh_tokens/i);
      expect(body()).toMatch(/DELETE\s+FROM\s+auth\.sessions/i);
      expect(body()).toMatch(/SET\s+banned_until\s*=\s*NULL/i);
    });
  });
});

describe('audit fixes migration', (): void => {
  const migration = pending.find((m: PendingMigration): boolean =>
    m.name.endsWith('_audit_fixes.sql'),
  );
  const sql = migration?.sql ?? '';
  const fn = (name: string): FunctionDefinition | undefined =>
    functionsOf(sql).find((f: FunctionDefinition): boolean => f.name === name);

  it('exists after the membership hardening migration and is transactional', (): void => {
    expect(migration?.name).toBe('20261103060000_audit_fixes.sql');
    expect(sql).toMatch(/^\s*BEGIN;/i);
    expect(sql).toMatch(/COMMIT;\s*$/i);
  });

  it('gives every function it defines a postgres-only grant and a pinned search_path', (): void => {
    for (const name of [
      'core.mark_tenant_deletion',
      'core.check_last_owner',
      'core.sync_business_account_access',
      'core.revoke_user_sessions',
    ]) {
      expect(fn(name), name).toBeDefined();
      expect(fn(name)?.header, name).toMatch(/SET\s+search_path\s*=\s*pg_catalog,\s*pg_temp/i);
      expect(sqlGrantsTo(sql, name), name).toBe('postgres');
    }
  });

  describe('D1 category integrity', (): void => {
    it('fails safe before touching constraints when cross-tenant products exist', (): void => {
      const check = sql.search(/RAISE\s+EXCEPTION[\s\S]*?category of another tenant/i);
      const constraint = sql.search(/ADD\s+CONSTRAINT\s+uq_categories_tenant_id_id/i);
      expect(check).toBeGreaterThan(-1);
      expect(constraint).toBeGreaterThan(check);
      expect(sql).toMatch(/c\.tenant_id\s*<>\s*p\.tenant_id/i);
      expect(sql).toMatch(/pg_catalog\.count\(\*\)/i);
    });

    it('adds the composite unique key and foreign key', (): void => {
      expect(sql).toMatch(
        /ALTER\s+TABLE\s+catalog\.categories\s+ADD\s+CONSTRAINT\s+uq_categories_tenant_id_id\s+UNIQUE\s*\(\s*tenant_id\s*,\s*id\s*\)/i,
      );
      expect(sql).toMatch(
        /FOREIGN\s+KEY\s*\(\s*tenant_id\s*,\s*category_id\s*\)\s+REFERENCES\s+catalog\.categories\s*\(\s*tenant_id\s*,\s*id\s*\)/i,
      );
    });
  });

  describe('D2 last owner', (): void => {
    const body = (): string => fn('core.check_last_owner')?.body ?? '';

    it('lets the cascade of a deleted tenant through but not a direct owner delete', (): void => {
      expect(body()).toMatch(
        /NOT\s+EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+core\.tenants\s+t\s+WHERE\s+t\.id\s*=\s*OLD\.tenant_id\s*\)/i,
      );
      expect(body()).toMatch(/core\.tenant_being_deleted/);
      expect(body()).toMatch(/último OWNER/);
      expect(sql).toMatch(
        /CREATE\s+TRIGGER\s+mark_tenant_deletion\s+BEFORE\s+DELETE\s+ON\s+core\.tenants/i,
      );
    });

    it('blocks suspending the last active owner and any tenant change', (): void => {
      expect(body()).toMatch(
        /OLD\.role\s*=\s*'OWNER'\s+AND\s+OLD\.status\s*=\s*'active'\s+AND\s+NEW\.status\s*<>\s*'active'/i,
      );
      expect(body()).toMatch(/m\.status\s*=\s*'active'/i);
      expect(body()).toMatch(/NEW\.tenant_id\s+IS\s+DISTINCT\s+FROM\s+OLD\.tenant_id/i);
      expect(body()).toMatch(/RETURN\s+OLD/i);
    });
  });

  describe('D3 business account access', (): void => {
    const body = (): string => fn('core.sync_business_account_access')?.body ?? '';

    it('is wired to INSERT, status UPDATE and DELETE', (): void => {
      for (const event of ['INSERT', String.raw`UPDATE\s+OF\s+status`, 'DELETE']) {
        expect(sql).toMatch(
          new RegExp(
            String.raw`CREATE\s+TRIGGER\s+\w+\s+AFTER\s+${event}\s+ON\s+core\.tenant_memberships[\s\S]*?EXECUTE\s+FUNCTION\s+core\.sync_business_account_access\(\)`,
            'i',
          ),
        );
      }
      expect(sql).toMatch(
        /ALTER\s+FUNCTION\s+core\.sync_business_account_access\(\)\s+OWNER\s+TO\s+postgres/i,
      );
    });

    it('evaluates the global state: any suspended managing membership keeps the ban', (): void => {
      expect(body()).toMatch(/m\.status\s*=\s*'suspended'/i);
      expect(body()).toMatch(/core\.is_business_account\(\s*v_user\s*,\s*m\.tenant_id\s*\)/i);
      expect(body()).toMatch(/NOT\s+EXISTS[\s\S]*?m\.status\s*=\s*'active'/i);
    });

    it('only lifts the long ban it sets itself', (): void => {
      expect(body()).toMatch(
        /SET\s+banned_until\s*=\s*NULL[\s\S]*?banned_until\s*>=\s*pg_catalog\.now\(\)\s*\+\s*interval\s+'50 years'/i,
      );
      expect(body()).toMatch(/DELETE\s+FROM\s+auth\.refresh_tokens/i);
      expect(body()).toMatch(/DELETE\s+FROM\s+auth\.sessions/i);
    });
  });

  describe('D4 session revocation', (): void => {
    it('is limited to business accounts and deletes sessions and refresh tokens', (): void => {
      const definition = fn('core.revoke_user_sessions');
      expect(definition?.header).toMatch(/^\s*p_user_id\s+uuid\s*\)\s*RETURNS\s+void/i);
      expect(definition?.header).toMatch(/SECURITY\s+DEFINER/i);
      expect(definition?.body).toMatch(/NOT\s+core\.is_business_account\(\s*p_user_id\s*\)/i);
      expect(definition?.body).toMatch(/DELETE\s+FROM\s+auth\.refresh_tokens/i);
      expect(definition?.body).toMatch(/DELETE\s+FROM\s+auth\.sessions/i);
      expect(sql).toMatch(
        /REVOKE\s+ALL\s+ON\s+FUNCTION\s+core\.revoke_user_sessions\(uuid\)\s+FROM\s+PUBLIC,\s*anon,\s*authenticated,\s*service_role/i,
      );
    });
  });
});

describe('business account single tenant migration', (): void => {
  const migration = pending.find((m: PendingMigration): boolean =>
    m.name.endsWith('_business_account_single_tenant.sql'),
  );
  const sql = migration?.sql ?? '';
  const fn = (name: string): FunctionDefinition | undefined =>
    functionsOf(sql).find((f: FunctionDefinition): boolean => f.name === name);

  it('exists after the audit fixes migration and is transactional', (): void => {
    expect(migration?.name).toBe('20261103070000_business_account_single_tenant.sql');
    expect(sql).toMatch(/^\s*BEGIN;/i);
    expect(sql).toMatch(/COMMIT;\s*$/i);
  });

  it('defines a pinned, postgres-owned, postgres-only SECURITY DEFINER enforcement function', (): void => {
    const definition = fn('core.enforce_business_account_single_tenant');
    expect(definition?.header).toMatch(/RETURNS\s+trigger/i);
    expect(definition?.header).toMatch(/SECURITY\s+DEFINER/i);
    expect(definition?.header).toMatch(/SET\s+search_path\s*=\s*pg_catalog,\s*pg_temp/i);
    expect(sql).toMatch(
      /ALTER\s+FUNCTION\s+core\.enforce_business_account_single_tenant\(\)\s+OWNER\s+TO\s+postgres/i,
    );
    expect(sql).toMatch(
      /REVOKE\s+ALL\s+ON\s+FUNCTION\s+core\.enforce_business_account_single_tenant\(\)\s+FROM\s+PUBLIC,\s*anon,\s*authenticated,\s*service_role/i,
    );
    expect(sql).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+core\.enforce_business_account_single_tenant\(\)\s+TO\s+postgres/i,
    );
  });

  it('refuses a business account in any tenant but its own with SQLSTATE P0004', (): void => {
    const body = fn('core.enforce_business_account_single_tenant')?.body ?? '';
    expect(body).toMatch(
      /core\.is_business_account\(\s*NEW\.user_id\s*\)\s+AND\s+NOT\s+core\.is_business_account\(\s*NEW\.user_id\s*,\s*NEW\.tenant_id\s*\)/i,
    );
    expect(body).toMatch(/ERRCODE\s*=\s*'P0004'/i);
  });

  it('fires BEFORE INSERT and BEFORE UPDATE OF tenant_id, user_id, after guard_membership_write', (): void => {
    expect(sql).toMatch(
      /CREATE\s+TRIGGER\s+(\w+)\s+BEFORE\s+INSERT\s+ON\s+core\.tenant_memberships\s+FOR\s+EACH\s+ROW\s+EXECUTE\s+FUNCTION\s+core\.enforce_business_account_single_tenant\(\)/i,
    );
    expect(sql).toMatch(
      /CREATE\s+TRIGGER\s+(\w+)\s+BEFORE\s+UPDATE\s+OF\s+tenant_id,\s*user_id\s+ON\s+core\.tenant_memberships[\s\S]*?EXECUTE\s+FUNCTION\s+core\.enforce_business_account_single_tenant\(\)/i,
    );
    for (const match of sql.matchAll(
      /CREATE\s+TRIGGER\s+(\w+)\s+BEFORE[^;]*?enforce_business_account_single_tenant/gi,
    )) {
      // Alphabetical order decides firing order: API roles must hit the guard first.
      expect(match[1].localeCompare('guard_membership_write')).toBeGreaterThan(0);
    }
  });

  it('redefines accept_invitation with an early P0004 check, keeping signature, grants and consent rules', (): void => {
    const definition = fn('core.accept_invitation');
    expect(definition?.header).toMatch(/SECURITY\s+DEFINER/i);
    expect(definition?.header).toMatch(/SET\s+search_path\s*=\s*pg_catalog,\s*pg_temp/i);
    const body = definition?.body ?? '';
    expect(body).toMatch(
      /core\.is_business_account\(\s*p_user_id\s*\)\s+AND\s+NOT\s+core\.is_business_account\(\s*p_user_id\s*,\s*v_inv\.tenant_id\s*\)/i,
    );
    expect(body).toMatch(/ERRCODE\s*=\s*'P0004'/i);
    expect(body.search(/P0004/)).toBeLessThan(
      body.search(/INSERT\s+INTO\s+core\.tenant_memberships/i),
    );
    expect(body).toMatch(/CASE\s+WHEN\s+NOT\s+demographic_consent/i);
    expect(sql).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+core\.accept_invitation\(text, uuid, boolean, text, text, text, text, text\)\s+TO\s+postgres/i,
    );
  });
});

describe('member permission check migration', (): void => {
  const migration = pending.find((m: PendingMigration): boolean =>
    m.name.endsWith('_member_permission_check.sql'),
  );
  const sql = migration?.sql ?? '';
  const definition = functionsOf(sql).find(
    (f: FunctionDefinition): boolean => f.name === 'core.member_has_permission',
  );

  it('exists after the single-tenant migration and is transactional', (): void => {
    expect(migration?.name).toBe('20261103080000_member_permission_check.sql');
    expect(sql).toMatch(/^\s*BEGIN;/im);
    expect(sql).toMatch(/COMMIT;\s*$/i);
  });

  it('is a pinned, postgres-owned, postgres-only SECURITY DEFINER function', (): void => {
    expect(definition?.header).toMatch(/RETURNS\s+boolean/i);
    expect(definition?.header).toMatch(/SECURITY\s+DEFINER/i);
    expect(definition?.header).toMatch(/SET\s+search_path\s*=\s*pg_catalog,\s*pg_temp/i);
    expect(sql).toMatch(
      /ALTER\s+FUNCTION\s+core\.member_has_permission\(uuid, uuid, text\[\]\)\s+OWNER\s+TO\s+postgres/i,
    );
    expect(sql).toMatch(
      /REVOKE\s+ALL\s+ON\s+FUNCTION\s+core\.member_has_permission\(uuid, uuid, text\[\]\)\s+FROM\s+PUBLIC,\s*anon,\s*authenticated,\s*service_role/i,
    );
    expect(sql).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+core\.member_has_permission\(uuid, uuid, text\[\]\)\s+TO\s+postgres/i,
    );
  });

  it('requires an active membership and scopes the custom role to the same tenant', (): void => {
    const body = definition?.body ?? '';
    expect(body).toMatch(/m\.status\s*=\s*'active'/i);
    expect(body).toMatch(/r\.tenant_id\s*=\s*m\.tenant_id/i);
    expect(body).toMatch(/m\.role\s+IN\s*\('OWNER',\s*'ADMIN'\)/i);
    expect(body).toMatch(/r\.permissions\s*&&\s*p_permissions/i);
  });
});

describe('default tenant roles migration', (): void => {
  const migration = pending.find((m: PendingMigration): boolean =>
    m.name.endsWith('_default_tenant_roles.sql'),
  );
  const sql = migration?.sql ?? '';

  it('exists after the permission check migration and is transactional', (): void => {
    expect(migration?.name).toBe('20261103090000_default_tenant_roles.sql');
    expect(sql).toMatch(/^\s*BEGIN;/im);
    expect(sql).toMatch(/COMMIT;\s*$/i);
  });

  it('seeds the four default roles without user management or integrations', (): void => {
    for (const key of ['admin', 'seller', 'catalog', 'analyst']) {
      expect(sql).toContain(`'${key}'`);
    }
    expect(sql).not.toMatch(/MANAGE_USERS|MANAGE_INTEGRATIONS/);
    expect(sql).toMatch(/ON CONFLICT DO NOTHING/i);
  });

  it('seeds new stores by trigger and backfills existing ones', (): void => {
    expect(sql).toMatch(/AFTER INSERT ON core\.tenants/i);
    expect(sql).toMatch(/SELECT core\.seed_default_tenant_roles\(id\) FROM core\.tenants;/i);
  });

  it('locks both functions to the postgres login', (): void => {
    for (const fn of [
      String.raw`core.seed_default_tenant_roles\(uuid\)`,
      String.raw`core.seed_default_tenant_roles_trigger\(\)`,
    ]) {
      expect(sql).toMatch(
        new RegExp(
          String.raw`REVOKE\s+ALL\s+ON\s+FUNCTION\s+${fn}\s+FROM\s+PUBLIC,\s*anon,\s*authenticated,\s*service_role`,
          'i',
        ),
      );
      expect(sql).toMatch(
        new RegExp(String.raw`GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+${fn}\s+TO\s+postgres`, 'i'),
      );
    }
  });
});

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ORDER_NOTIFICATION_EVENT_TYPES } from '@/notifications/application/notification-events';

const BASELINE_VERSION = '20261014000000';
const SEED_TABLES: Readonly<Record<string, readonly string[]>> = {
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
    (_name: string, sql: string): void => {
      for (const match of sql.matchAll(/\bGRANT\b[^;]*?\bTO\b\s+([^;]+);/gi)) {
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

  it('seeds exactly the order notification routes for outbox_worker_role', (): void => {
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
    expect([...seeded].sort()).toEqual([...expected].sort());
    expect(expected).toHaveLength(5);
  });
});

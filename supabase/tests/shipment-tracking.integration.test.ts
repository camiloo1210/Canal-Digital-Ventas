import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env.TRACKING_TEST_DATABASE_URL;
describe.skipIf(!url)(
  'shipment tracking PostgreSQL security (dedicated local database)',
  (): void => {
    let sql: postgres.Sql<Record<string, unknown>>;
    beforeAll((): void => {
      const parsed = new URL(url as string);
      if (
        !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) ||
        parsed.port !== '55439' ||
        !/^\/cdv_tracking_test(?:_[a-z0-9_]+)?$/.test(parsed.pathname)
      )
        throw new Error('Dedicated local tracking test database required');
      sql = postgres(parsed.href, { max: 2, prepare: false, connect_timeout: 5 });
    });
    afterAll(async (): Promise<void> => {
      await sql?.end({ timeout: 5 });
    });
    it('enables RLS and blocks browser roles from direct access', async (): Promise<void> => {
      const [row] = await sql<
        {
          enabled: boolean;
          anon_read: boolean;
          authenticated_read: boolean;
          worker_read: boolean;
        }[]
      >`
      SELECT c.relrowsecurity AS enabled,
        pg_catalog.has_table_privilege('anon', c.oid, 'SELECT') AS anon_read,
        pg_catalog.has_table_privilege('authenticated', c.oid, 'SELECT') AS authenticated_read,
        pg_catalog.has_table_privilege('shipment_tracking_worker_role', c.oid, 'SELECT') AS worker_read
      FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'sales' AND c.relname = 'shipment_tracking_links'`;
      expect(row).toEqual({
        enabled: true,
        anon_read: false,
        authenticated_read: false,
        worker_read: true,
      });
    });
    it('installs an enabled fencing trigger inaccessible to browser roles', async (): Promise<void> => {
      const [row] = await sql<
        { enabled: boolean; anon_exec: boolean; authenticated_exec: boolean }[]
      >`
      SELECT t.tgenabled <> 'D' AS enabled,
        pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
        pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_exec
      FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_proc p ON p.oid = t.tgfoid
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'sales' AND p.proname = 'fence_tracking_on_guide_change' AND NOT t.tgisinternal`;
      expect(row).toEqual({ enabled: true, anon_exec: false, authenticated_exec: false });
    });
  },
);

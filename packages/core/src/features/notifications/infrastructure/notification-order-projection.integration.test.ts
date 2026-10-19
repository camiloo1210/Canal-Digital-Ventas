import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postgres from 'postgres';
import { describe, expect, it } from 'vitest';
import { parseNotificationOrder } from '@/notifications/infrastructure/notification-order-projection';

const url = process.env.NOTIFICATION_TEST_DATABASE_URL;
class ProjectionRollback extends Error {}

describe.skipIf(!url)(
  'notification projection on Supabase Cloud (always rolled back)',
  (): void => {
    it('reads stored order values through the restricted worker and rejects cross-tenant and public access', async (): Promise<void> => {
      const sql = postgres(url!, { max: 1, prepare: false, connect_timeout: 10 });
      try {
        try {
          await sql.begin(async (tx): Promise<void> => {
            await tx`SET LOCAL statement_timeout = '15s'`;
            await tx`SET LOCAL lock_timeout = '5s'`;
            await tx.unsafe(
              readFileSync(
                resolve(
                  'supabase/migrations/20261019054323_rich_order_notification_projection.sql',
                ),
                'utf8',
              ),
            );
            await tx`GRANT notification_worker_role TO current_user`;
            const [sample] = await tx<
              { id: string; tenant_id: string; total_amount_cents: number; count: number }[]
            >`
          SELECT o.id,o.tenant_id,o.total_amount_cents,
            (SELECT count(*)::integer FROM sales.order_items i WHERE i.order_id=o.id) AS count
          FROM sales.orders o JOIN sales.customers c ON c.id=o.customer_id AND c.tenant_id=o.tenant_id
          ORDER BY o.id LIMIT 1`;
            expect(sample, 'Cloud verification requires one existing order').toBeDefined();
            await tx`SET LOCAL ROLE notification_worker_role`;
            const [row] = await tx<
              { details: unknown }[]
            >`SELECT core.read_order_notification_details(${sample.tenant_id}::uuid,${sample.id}::uuid) AS details`;
            const details = parseNotificationOrder(row.details);
            expect(details.orderId).toBe(sample.id);
            expect(details.totalAmountCents).toBe(Number(sample.total_amount_cents));
            expect(details.items).toHaveLength(sample.count);
            const [foreign] = await tx<
              { details: unknown }[]
            >`SELECT core.read_order_notification_details(${crypto.randomUUID()}::uuid,${sample.id}::uuid) AS details`;
            expect(foreign.details).toBeNull();
            await expect(
              tx.savepoint(async (sp): Promise<void> => {
                await sp`SELECT * FROM sales.orders LIMIT 1`;
              }),
            ).rejects.toMatchObject({ code: '42501' });
            await tx`RESET ROLE`;
            await tx`SET LOCAL ROLE anon`;
            await expect(
              tx.savepoint(async (sp): Promise<void> => {
                await sp`SELECT core.read_order_notification_details(${sample.tenant_id}::uuid,${sample.id}::uuid)`;
              }),
            ).rejects.toMatchObject({ code: '42501' });
            throw new ProjectionRollback();
          });
        } catch (error: unknown) {
          if (!(error instanceof ProjectionRollback)) throw error;
        }
      } finally {
        await sql.end({ timeout: 5 });
      }
    });
  },
);

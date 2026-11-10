import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import { PostgresTransactionManagerAdapter } from '@/shared/infrastructure/adapters/postgres-transaction-manager.adapter';
import { PostgresShipmentJobQueueAdapter } from '@/shipment-creation/infrastructure/postgres-shipment-job-queue.adapter';
import { PostgresShipmentJobRepository } from '@/shipment-creation/infrastructure/postgres-shipment-job-repository';
import { PostgresShipmentCreationSource } from '@/shipment-creation/infrastructure/postgres-shipment-creation-source';
import { PostgresCarrierShipmentRecordAdapter } from '@/shipment-creation/infrastructure/postgres-carrier-shipment-record.adapter';
import { PostgresShippingOriginRepository } from '@/tenants/infrastructure/repositories/postgres-shipping-origin.repository';
import { PostgresTrackingActivationAdapter } from '@/shipment-tracking/infrastructure/postgres-tracking-activation.adapter';
import { ShippingOrigin } from '@/tenants/domain/value-objects/shipping-origin.vo';
import { ShipmentRetryNotAllowedException } from '@/shipment-creation/application/exceptions/shipment-retry-not-allowed.exception';
import { CreateShipmentUseCase } from '@/shipment-creation/application/use-cases/create-shipment.use-case';
import type { ClaimedJob } from '@/shipment-creation/application/ports/out/shipment-job-repository.port';

// Dedicated suites: OWNER is the application connection (table owner, like DATABASE_URL in the
// web app); WORKER logs in as canaldigital_shipment_creation. Both must point at a disposable
// local database with every migration applied.
const OWNER_URL = process.env.SHIPMENT_CREATION_TEST_DATABASE_URL;
const WORKER_URL = process.env.SHIPMENT_CREATION_WORKER_TEST_DATABASE_URL;
type Sql = postgres.Sql<Record<string, unknown>>;

interface Fixture {
  tenantId: string;
  orderId: string;
  productId: string;
}

describe.skipIf(!OWNER_URL || !WORKER_URL)(
  'shipment creation PostgreSQL (migrations, worker role, adapters)',
  (): void => {
    let owner: Sql;
    let worker: Sql;
    const actorId = randomUUID();
    const deploymentId = randomUUID();
    let a: Fixture;
    let b: Fixture;
    let createdEnvironment = false;
    const userIds: string[] = [];
    const extraTenants: string[] = [];

    const hosts = (url: string): string => new URL(url).hostname;

    async function fixture(label: string): Promise<Fixture> {
      const tenantId = randomUUID();
      const orderId = randomUUID();
      const productId = randomUUID();
      const customerId = randomUUID();
      const categoryId = randomUUID();
      await owner`INSERT INTO core.tenants (id, name, slug, contact_email, base_currency, status)
        VALUES (${tenantId}, ${`ship ${label}`}, ${`ship-${tenantId}`}, ${`${tenantId}@example.test`}, 'USD', 'active')`;
      await owner`INSERT INTO catalog.categories (id, name, tenant_id, description, status, slug)
        VALUES (${categoryId}, 'c', ${tenantId}, 'c', 'active', ${`c-${categoryId}`})`;
      await owner`INSERT INTO catalog.products (id, name, price_cents, cost_cents, wholesale_price_cents,
          description, stock, category_id, status, sku, tenant_id, weight_grams, length_mm, width_mm, height_mm)
        VALUES (${productId}, 'p', 100, 50, 0, 'd', 5, ${categoryId}, 'active', ${`sku-${productId}`},
          ${tenantId}, 500, 100, 100, 100)`;
      await owner`INSERT INTO sales.customers (id, tenant_id, name, email, phone, document_id, status,
          address_street, address_city, address_state, address_zip_code, address_country)
        VALUES (${customerId}, ${tenantId}, ${`Buyer ${label}`}, 'b@example.test', '3000000000', 'D1', 'active',
          's', 'c', 'st', 'z', 'CO')`;
      await owner`INSERT INTO sales.orders (id, order_number, customer_id, tenant_id, status, subtotal_cents,
          tax_amount_cents, discount_amount_cents, shipping_cost_cents, total_amount_cents,
          shipping_address_street, shipping_address_city, shipping_address_state,
          shipping_address_zip_code, shipping_address_country, currency)
        VALUES (${orderId}, ${`N-${orderId}`}, ${customerId}, ${tenantId}, 'processing', 100, 0, 0, 0, 100,
          'Calle 1', 'Bogota', 'DC', '110111', 'CO', 'USD')`;
      await owner`INSERT INTO sales.order_items (id, order_id, product_id, product_name, quantity,
          unit_price_cents, sku, subtotal_cents)
        VALUES (${randomUUID()}, ${orderId}, ${productId}, 'p', 2, 100, 'sku', 200)`;
      await owner`INSERT INTO core.tenant_shipping_origins (tenant_id, contact_name, phone, street, city,
          state, zip_code, country) VALUES (${tenantId}, 'Seller', '3111111111', 'Cra 7', 'Bogota', 'DC',
          '110221', 'CO')`;
      return { tenantId, orderId, productId };
    }

    async function enqueue(f: Fixture): Promise<void> {
      const manager = new PostgresTransactionManagerAdapter(owner);
      await manager.runInTransaction(
        (tx): Promise<void> =>
          new PostgresShipmentJobQueueAdapter().enqueue(f.tenantId, f.orderId, tx),
        { userId: actorId, tenantId: f.tenantId },
      );
    }

    const jobState = async (f: Fixture): Promise<Record<string, unknown>> =>
      (
        await owner`SELECT state, reason, attempts, lease_token, provider_tracking_number, label_path
          FROM sales.shipment_creation_jobs WHERE order_id = ${f.orderId}`
      )[0];

    beforeAll(async (): Promise<void> => {
      for (const url of [OWNER_URL as string, WORKER_URL as string])
        if (!['localhost', '127.0.0.1', '[::1]'].includes(hosts(url)))
          throw new Error('Disposable local database required');
      owner = postgres(OWNER_URL as string, { max: 4, prepare: false, connect_timeout: 5 });
      worker = postgres(WORKER_URL as string, { max: 2, prepare: false, connect_timeout: 5 });
      a = await fixture('A');
      b = await fixture('B');
      const existing = await owner`SELECT 1 FROM sales.shipment_tracking_environment`;
      if (existing.length === 0) {
        await owner`INSERT INTO sales.shipment_tracking_environment (environment, deployment_id)
          VALUES ('sandbox', ${deploymentId})`;
        createdEnvironment = true;
      }
    });

    afterAll(async (): Promise<void> => {
      const tenants = [a?.tenantId, b?.tenantId, ...extraTenants].filter((id): id is string =>
        Boolean(id),
      );
      try {
        // Replica role skips the last-owner guard and FK triggers; the order of deletes is free.
        await owner.begin(async (tx): Promise<void> => {
          await tx`SET LOCAL session_replication_role = replica`;
          for (const table of [
            'sales.shipment_tracking_links',
            'sales.manual_shipment_history',
            'sales.manual_shipments',
            'sales.shipment_creation_jobs',
            'sales.orders',
            'sales.customers',
            'catalog.products',
            'catalog.categories',
            'core.tenant_memberships',
          ])
            await tx`DELETE FROM ${tx(table)} WHERE tenant_id = ANY(${tenants}::uuid[])`;
          await tx`DELETE FROM sales.order_items WHERE order_id NOT IN (SELECT id FROM sales.orders)`;
          await tx`DELETE FROM core.tenant_shipping_origins WHERE tenant_id = ANY(${tenants}::uuid[])`;
          await tx`DELETE FROM core.tenants WHERE id = ANY(${tenants}::uuid[])`;
          await tx`DELETE FROM core.users WHERE id = ANY(${userIds}::uuid[])`;
          await tx`DELETE FROM auth.users WHERE id = ANY(${userIds}::uuid[])`;
          if (createdEnvironment) await tx`DELETE FROM sales.shipment_tracking_environment`;
        });
      } finally {
        await worker?.end({ timeout: 5 });
        await owner?.end({ timeout: 5 });
      }
    });

    it('enqueue is idempotent: two calls leave one queued row', async (): Promise<void> => {
      await enqueue(a);
      await enqueue(a);
      const rows =
        await owner`SELECT state, attempts FROM sales.shipment_creation_jobs WHERE order_id = ${a.orderId}`;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ state: 'queued', attempts: 0 });
    });

    it('the worker login sees nothing before a job is queued for another tenant', async (): Promise<void> => {
      const source = new PostgresShipmentCreationSource(worker);
      expect(await source.load(b.tenantId, b.orderId)).toBeNull();
      expect(
        await worker`SELECT 1 FROM core.tenant_shipping_origins WHERE tenant_id = ${b.tenantId}`,
      ).toHaveLength(0);
      expect(await worker`SELECT 1 FROM catalog.products WHERE id = ${b.productId}`).toHaveLength(
        0,
      );
    });

    it('claims, marks creating, and reads only what the leased job needs', async (): Promise<void> => {
      const repo = new PostgresShipmentJobRepository(worker);
      const job = await repo.claimNext(new Date(), 60);
      expect(job).toMatchObject({
        orderId: a.orderId,
        tenantId: a.tenantId,
        claimedFrom: 'queued',
        attempts: 1,
      });
      expect(await repo.markCreating(job as NonNullable<typeof job>)).toBe(true);
      expect(await repo.claimNext(new Date(), 60)).toBeNull();

      const source = await new PostgresShipmentCreationSource(worker).load(a.tenantId, a.orderId);
      expect(source?.recipient).toMatchObject({
        name: 'Buyer A',
        phone: '3000000000',
        country: 'CO',
      });
      expect(source?.hasRecordedShipment).toBe(false);
      expect(source?.items).toEqual([
        {
          quantity: 2,
          packageData: { weightGrams: 500, lengthMm: 100, widthMm: 100, heightMm: 100 },
        },
      ]);
      const origin = await new PostgresShippingOriginRepository(worker).find(a.tenantId);
      expect(origin?.city).toBe('Bogota');
      // Other tenant (no active job) remains invisible.
      expect(await worker`SELECT 1 FROM sales.orders WHERE id = ${b.orderId}`).toHaveLength(0);
      expect(await new PostgresShippingOriginRepository(worker).find(b.tenantId)).toBeNull();
    });

    it('cannot read or write columns outside its grants', async (): Promise<void> => {
      await expect(worker`SELECT email FROM sales.customers`).rejects.toMatchObject({
        code: '42501',
      });
      await expect(worker`SELECT price_cents FROM catalog.products`).rejects.toMatchObject({
        code: '42501',
      });
      await expect(worker`SELECT payment_gateway_id FROM sales.orders`).rejects.toMatchObject({
        code: '42501',
      });
      await expect(worker`UPDATE sales.orders SET status = 'delivered'`).rejects.toMatchObject({
        code: '42501',
      });
      await expect(worker`UPDATE catalog.products SET stock = 0`).rejects.toMatchObject({
        code: '42501',
      });
      await expect(
        worker`UPDATE sales.shipment_creation_jobs SET tenant_id = ${b.tenantId}`,
      ).rejects.toMatchObject({ code: '42501' });
      await expect(worker`DELETE FROM sales.shipment_creation_jobs`).rejects.toMatchObject({
        code: '42501',
      });
      await expect(
        worker`INSERT INTO sales.shipment_creation_jobs (order_id, tenant_id) VALUES (${b.orderId}, ${b.tenantId})`,
      ).rejects.toMatchObject({ code: '42501' });
      await expect(
        worker`UPDATE core.tenant_shipping_origins SET city = 'x'`,
      ).rejects.toMatchObject({ code: '42501' });
    });

    it('records the shipment, tracking link and completion in one worker transaction', async (): Promise<void> => {
      const claimedRows =
        await owner`SELECT lease_token FROM sales.shipment_creation_jobs WHERE order_id = ${a.orderId}`;
      const job = {
        tenantId: a.tenantId,
        orderId: a.orderId,
        leaseToken: String(claimedRows[0].lease_token),
        leaseSeconds: 60,
        attempts: 1,
        claimedFrom: 'queued' as const,
      };
      const repo = new PostgresShipmentJobRepository(worker);
      await worker.begin(async (sqlTx): Promise<void> => {
        const tx: TransactionContext = {
          executeNative: <C, R>(callback: (conn: C) => Promise<R>): Promise<R> =>
            callback(sqlTx as unknown as C),
        };
        await new PostgresCarrierShipmentRecordAdapter().record(
          {
            tenantId: a.tenantId,
            orderId: a.orderId,
            carrier: 'FedEx',
            trackingNumber: 'TRK123',
            actorId,
          },
          tx,
        );
        await new PostgresTrackingActivationAdapter((): string => 'cred-ref', deploymentId).enable(
          { tenantId: a.tenantId, orderId: a.orderId, trackingNumber: 'TRK123', provider: 'fedex' },
          tx,
        );
        await repo.complete(job, `${a.tenantId}/${randomUUID()}.pdf`, tx);
      });
      expect(await jobState(a)).toMatchObject({ state: 'done', reason: null, lease_token: null });
      const shipment =
        await owner`SELECT carrier, tracking_number, version FROM sales.manual_shipments WHERE order_id = ${a.orderId}`;
      expect(shipment[0]).toMatchObject({ carrier: 'FedEx', tracking_number: 'TRK123' });
      expect(
        await owner`SELECT 1 FROM sales.manual_shipment_history WHERE order_id = ${a.orderId}`,
      ).toHaveLength(1);
      expect(
        await owner`SELECT 1 FROM sales.shipment_tracking_links WHERE order_id = ${a.orderId} AND active`,
      ).toHaveLength(1);
      // Once done the worker no longer sees the order or the origin.
      expect(await worker`SELECT 1 FROM sales.orders WHERE id = ${a.orderId}`).toHaveLength(0);
    });

    it('re-claims a crashed creating job as claimedFrom creating, and retry refuses when a tracking number exists', async (): Promise<void> => {
      await enqueue(b);
      const repo = new PostgresShipmentJobRepository(worker);
      const first = await repo.claimNext(new Date(), 30);
      expect(first?.orderId).toBe(b.orderId);
      expect(await repo.markCreating(first as NonNullable<typeof first>)).toBe(true);
      // Worker "crashes": lease expires.
      await owner`UPDATE sales.shipment_creation_jobs SET lease_until = clock_timestamp() - interval '1 second' WHERE order_id = ${b.orderId}`;
      const second = await repo.claimNext(new Date(), 30);
      expect(second).toMatchObject({ orderId: b.orderId, claimedFrom: 'creating', attempts: 2 });
      const stale = first as NonNullable<typeof first>;
      expect(await repo.markCreating(stale)).toBe(false);

      await repo.markNeedsAttention(
        second as NonNullable<typeof second>,
        'AMBIGUOUS_RESULT',
        'TRK999',
      );
      expect(await jobState(b)).toMatchObject({
        state: 'needs_attention',
        reason: 'AMBIGUOUS_RESULT',
        provider_tracking_number: 'TRK999',
      });
      // Seller retry runs as the application connection (owner), needs MANAGE_ORDERS membership.
      const userId = randomUUID();
      await owner`INSERT INTO auth.users (id, email) VALUES (${userId}, ${`${userId}@example.test`})`;
      await owner`INSERT INTO core.users (id, email, status) VALUES (${userId}, ${`${userId}@example.test`}, 'active') ON CONFLICT (id) DO NOTHING`;
      await owner`INSERT INTO core.tenant_memberships (user_id, tenant_id, role, status) VALUES (${userId}, ${b.tenantId}, 'OWNER', 'active')`;
      const ownerRepo = new PostgresShipmentJobRepository(owner);
      await expect(ownerRepo.retry(b.tenantId, b.orderId, userId)).rejects.toBeInstanceOf(
        ShipmentRetryNotAllowedException,
      );
      expect(await ownerRepo.retry(b.tenantId, b.orderId, randomUUID())).toBe(false);

      // Without a provider tracking number a needs_attention job can be retried.
      await owner`UPDATE sales.shipment_creation_jobs SET provider_tracking_number = NULL WHERE order_id = ${b.orderId}`;
      expect(await ownerRepo.retry(b.tenantId, b.orderId, userId)).toBe(true);
      expect(await jobState(b)).toMatchObject({ state: 'queued', reason: null, lease_token: null });

      // The seller read model query shape (uuid[] binding) works against the real schema.
      const rows = await owner`SELECT j.order_id, j.state FROM sales.shipment_creation_jobs j
        JOIN core.tenant_memberships m ON m.tenant_id = j.tenant_id
        WHERE j.tenant_id = ${b.tenantId}::uuid AND m.user_id = ${userId}::uuid AND m.status = 'active'
          AND core.member_has_permission(m.user_id, m.tenant_id, ARRAY['VIEW_ORDERS','MANAGE_ORDERS']::text[])
          AND j.order_id = ANY(${[b.orderId, a.orderId]}::uuid[])`;
      expect(rows.map((r): unknown => r.order_id)).toEqual([b.orderId]);
      userIds.push(userId);
    });

    async function extraFixture(label: string): Promise<Fixture> {
      const f = await fixture(label);
      extraTenants.push(f.tenantId);
      return f;
    }

    /** Leases a job directly (no claimNext) so earlier tests' queued jobs cannot interfere. */
    async function lease(f: Fixture, state: 'queued' | 'creating'): Promise<ClaimedJob> {
      const leaseToken = randomUUID();
      await owner`UPDATE sales.shipment_creation_jobs SET state = ${state}, lease_token = ${leaseToken},
          lease_until = clock_timestamp() + interval '60 seconds', attempts = attempts + 1
        WHERE order_id = ${f.orderId}`;
      return {
        tenantId: f.tenantId,
        orderId: f.orderId,
        leaseToken,
        leaseSeconds: 60,
        attempts: 1,
        claimedFrom: 'queued',
      };
    }

    async function sellerTyped(f: Fixture, trackingNumber: string): Promise<void> {
      await owner`INSERT INTO sales.manual_shipments (order_id, tenant_id, carrier, tracking_number, version)
        VALUES (${f.orderId}, ${f.tenantId}, 'Servientrega', ${trackingNumber}, 1)`;
    }

    it('the worker reads a seller-recorded tracking number only for its own queued or creating job', async (): Promise<void> => {
      const c = await extraFixture('C');
      const d = await extraFixture('D');
      await enqueue(c);
      await enqueue(d);
      await sellerTyped(c, 'SELLER-C');
      await sellerTyped(d, 'SELLER-D');
      const manualRows = async (f: Fixture): Promise<number> =>
        (
          await worker`SELECT order_id, tenant_id, tracking_number FROM sales.manual_shipments
            WHERE order_id = ${f.orderId}`
        ).length;

      // Queued (before markCreating): visible, so the worker can stop before calling the carrier.
      expect(await manualRows(c)).toBe(1);
      expect(
        (await new PostgresShipmentCreationSource(worker).load(c.tenantId, c.orderId))
          ?.hasRecordedShipment,
      ).toBe(true);
      await lease(c, 'creating');
      expect(await manualRows(c)).toBe(1);
      // A job that is no longer active hides the row again; other columns stay ungranted.
      await owner`UPDATE sales.shipment_creation_jobs SET state = 'needs_attention', lease_token = NULL,
          lease_until = NULL WHERE order_id = ${d.orderId}`;
      expect(await manualRows(d)).toBe(0);
      await owner`UPDATE sales.shipment_creation_jobs SET state = 'done', lease_token = NULL,
          lease_until = NULL WHERE order_id = ${c.orderId}`;
      expect(await manualRows(c)).toBe(0);
      await expect(worker`SELECT updated_at FROM sales.manual_shipments`).rejects.toMatchObject({
        code: '42501',
      });
    });

    it('ends a queued job SHIPMENT_ALREADY_RECORDED without calling the carrier or overwriting', async (): Promise<void> => {
      const e = await extraFixture('E');
      await enqueue(e);
      await sellerTyped(e, 'SELLER-E');
      const job = await lease(e, 'queued');
      const create = (): never => {
        throw new Error('carrier must not be called');
      };
      const unused = (): never => {
        throw new Error('must not be reached');
      };
      await new CreateShipmentUseCase(
        new PostgresShipmentJobRepository(worker),
        new PostgresShipmentCreationSource(worker),
        new PostgresShippingOriginRepository(worker),
        { create },
        { put: unused, signedUrl: unused },
        { record: unused },
        { enable: unused },
        new PostgresTransactionManagerAdapter(worker),
        {
          accountNumber: '1',
          serviceType: 'S',
          systemActorId: actorId,
          credentialRefForTenant: (): string => 'cred-ref',
        },
      ).execute(job);
      expect(await jobState(e)).toMatchObject({
        state: 'needs_attention',
        reason: 'SHIPMENT_ALREADY_RECORDED',
        lease_token: null,
        provider_tracking_number: null,
      });
      const shipment =
        await owner`SELECT tracking_number, version FROM sales.manual_shipments WHERE order_id = ${e.orderId}`;
      expect(shipment[0]).toMatchObject({ tracking_number: 'SELLER-E', version: 1 });
    });

    it('records the carrier tracking number after the lease was lost, and retry stays refused', async (): Promise<void> => {
      const g = await extraFixture('G');
      await enqueue(g);
      const repo = new PostgresShipmentJobRepository(worker);
      const mine = await lease(g, 'queued');
      expect(await repo.markCreating(mine)).toBe(true);
      // Second replica re-claims after the lease "expired": our token no longer matches.
      const theirs = await lease(g, 'creating');
      await expect(
        worker.begin(async (sqlTx): Promise<void> => {
          const tx: TransactionContext = {
            executeNative: <C, R>(callback: (conn: C) => Promise<R>): Promise<R> =>
              callback(sqlTx as unknown as C),
          };
          await repo.complete(mine, null, tx);
        }),
      ).rejects.toThrow('lease lost');
      await repo.markNeedsAttention(mine, 'AMBIGUOUS_RESULT', 'TRK-LOST'); // fenced: no-op
      expect((await jobState(g)).provider_tracking_number).toBeNull();

      await repo.recordProviderTrackingNumber(mine, 'TRK-KEPT');
      expect(await jobState(g)).toMatchObject({
        state: 'creating',
        lease_token: theirs.leaseToken,
        provider_tracking_number: 'TRK-KEPT',
      });
      // First number wins.
      await repo.recordProviderTrackingNumber(mine, 'TRK-OTHER');
      expect((await jobState(g)).provider_tracking_number).toBe('TRK-KEPT');

      // The other replica quarantines as ambiguous; the number survives and blocks retry.
      await repo.markNeedsAttention(theirs, 'AMBIGUOUS_RESULT');
      expect(await jobState(g)).toMatchObject({
        state: 'needs_attention',
        provider_tracking_number: 'TRK-KEPT',
      });
      const userId = randomUUID();
      await owner`INSERT INTO auth.users (id, email) VALUES (${userId}, ${`${userId}@example.test`})`;
      await owner`INSERT INTO core.users (id, email, status) VALUES (${userId}, ${`${userId}@example.test`}, 'active') ON CONFLICT (id) DO NOTHING`;
      await owner`INSERT INTO core.tenant_memberships (user_id, tenant_id, role, status) VALUES (${userId}, ${g.tenantId}, 'OWNER', 'active')`;
      userIds.push(userId);
      await expect(
        new PostgresShipmentJobRepository(owner).retry(g.tenantId, g.orderId, userId),
      ).rejects.toBeInstanceOf(ShipmentRetryNotAllowedException);
    });

    it('never touches a done job when recording a carrier tracking number', async (): Promise<void> => {
      const h = await extraFixture('H');
      await enqueue(h);
      const job = await lease(h, 'creating');
      await owner`UPDATE sales.shipment_creation_jobs SET state = 'done', lease_token = NULL,
          lease_until = NULL WHERE order_id = ${h.orderId}`;
      await new PostgresShipmentJobRepository(worker).recordProviderTrackingNumber(job, 'TRK-DONE');
      expect((await jobState(h)).provider_tracking_number).toBeNull();
    });

    it('upserts and reads the shipping origin as the application connection', async (): Promise<void> => {
      const repo = new PostgresShippingOriginRepository(owner);
      const manager = new PostgresTransactionManagerAdapter(owner);
      const origin = ShippingOrigin.create({
        contactName: 'New',
        phone: '1',
        street: 's',
        city: 'Medellin',
        state: 'AN',
        zipCode: '050001',
        country: 'CO',
      });
      await manager.runInTransaction((tx): Promise<void> => repo.save(a.tenantId, origin, tx), {
        userId: actorId,
      });
      await manager.runInTransaction((tx): Promise<void> => repo.save(a.tenantId, origin, tx), {
        userId: actorId,
      });
      expect((await repo.find(a.tenantId))?.city).toBe('Medellin');
    });

    it('enforces package data all-or-none and positive values', async (): Promise<void> => {
      const id = b.productId;
      await expect(
        owner`UPDATE catalog.products SET weight_grams = NULL WHERE id = ${id}`,
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        owner`UPDATE catalog.products SET weight_grams = 0 WHERE id = ${id}`,
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        owner`UPDATE catalog.products SET length_mm = -1 WHERE id = ${id}`,
      ).rejects.toMatchObject({ code: '23514' });
      await owner`UPDATE catalog.products SET weight_grams = NULL, length_mm = NULL, width_mm = NULL, height_mm = NULL WHERE id = ${id}`;
    });
  },
);

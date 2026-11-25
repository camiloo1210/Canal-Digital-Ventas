import { describe, expect, it, vi } from 'vitest';
import type postgres from 'postgres';
import {
  PostgresShipmentCreationSource,
  ShipmentCreationSourceException,
} from '@/shipment-creation/infrastructure/postgres-shipment-creation-source';
import {
  CarrierShipmentRecordException,
  PostgresCarrierShipmentRecordAdapter,
} from '@/shipment-creation/infrastructure/postgres-carrier-shipment-record.adapter';
import {
  LabelStorageException,
  SupabaseLabelStorageAdapter,
  type LabelStorageClient,
} from '@/shipment-creation/infrastructure/supabase-label-storage.adapter';
import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';

const TENANT = '11111111-1111-4111-8111-111111111111';
const ORDER = '22222222-2222-4222-8222-222222222222';
const LABEL_ID = '44444444-4444-4444-8444-444444444444';
type Query = ReturnType<typeof vi.fn>;
const asSql = (query: Query): postgres.Sql<Record<string, unknown>> =>
  query as unknown as postgres.Sql<Record<string, unknown>>;
const txWith = (query: Query): TransactionContext => ({
  executeNative: async <C, R>(fn: (connection: C) => Promise<R>): Promise<R> =>
    fn(query as unknown as C),
});

describe('postgres shipment creation source', (): void => {
  it('maps recipient and per-item package data, nulling incomplete products', async (): Promise<void> => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([
        {
          status: 'processing',
          name: 'Buyer',
          phone: '310',
          street: 'Cra 2',
          city: 'Medellin',
          state: 'ANT',
          zip_code: '050001',
          country: 'CO',
          has_recorded_shipment: false,
        },
      ])
      .mockResolvedValueOnce([
        { quantity: 2, weight_grams: 500, length_mm: 300, width_mm: 200, height_mm: 50 },
        { quantity: 1, weight_grams: null, length_mm: null, width_mm: null, height_mm: null },
      ]);
    const source = await new PostgresShipmentCreationSource(asSql(query)).load(TENANT, ORDER);
    expect(source).toEqual({
      orderStatus: 'processing',
      hasRecordedShipment: false,
      recipient: {
        name: 'Buyer',
        phone: '310',
        street: 'Cra 2',
        city: 'Medellin',
        state: 'ANT',
        zipCode: '050001',
        country: 'CO',
      },
      items: [
        {
          quantity: 2,
          packageData: { weightGrams: 500, lengthMm: 300, widthMm: 200, heightMm: 50 },
        },
        { quantity: 1, packageData: null },
      ],
    });
    const order = (query.mock.calls[0]?.[0] as TemplateStringsArray).join('?');
    expect(order).toMatch(
      /EXISTS \(SELECT 1 FROM sales\.manual_shipments m\s+WHERE m\.order_id = o\.id AND m\.tenant_id = o\.tenant_id AND m\.tracking_number IS NOT NULL\)/,
    );
    const items = (query.mock.calls[1]?.[0] as TemplateStringsArray).join('?');
    expect(items).toContain(
      'LEFT JOIN catalog.products p ON p.id = oi.product_id AND p.tenant_id = ',
    );
  });

  it('reports a recorded seller shipment', async (): Promise<void> => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([
        {
          status: 'processing',
          name: 'Buyer',
          phone: '310',
          street: 'Cra 2',
          city: 'Medellin',
          state: 'ANT',
          zip_code: '050001',
          country: 'CO',
          has_recorded_shipment: true,
        },
      ])
      .mockResolvedValueOnce([]);
    const source = await new PostgresShipmentCreationSource(asSql(query)).load(TENANT, ORDER);
    expect(source?.hasRecordedShipment).toBe(true);
  });

  it('returns null for an invisible order and translates failures', async (): Promise<void> => {
    expect(
      await new PostgresShipmentCreationSource(asSql(vi.fn().mockResolvedValue([]))).load(
        TENANT,
        ORDER,
      ),
    ).toBeNull();
    await expect(
      new PostgresShipmentCreationSource(asSql(vi.fn().mockRejectedValue(new Error('x')))).load(
        TENANT,
        ORDER,
      ),
    ).rejects.toBeInstanceOf(ShipmentCreationSourceException);
  });
});

describe('postgres carrier shipment record adapter', (): void => {
  const input = {
    tenantId: TENANT,
    orderId: ORDER,
    carrier: 'FedEx' as const,
    trackingNumber: '794600000001',
    actorId: '00000000-0000-4000-8000-000000000051',
  };

  it('upserts the shipment with a new version and writes matching history', async (): Promise<void> => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([{ version: 3 }])
      .mockResolvedValueOnce([]);
    await new PostgresCarrierShipmentRecordAdapter().record(input, txWith(query));
    const upsert = (query.mock.calls[0]?.[0] as TemplateStringsArray).join('?');
    expect(upsert).toContain('ON CONFLICT (order_id) DO UPDATE');
    expect(upsert).toContain('version = sales.manual_shipments.version + 1');
    const history = (query.mock.calls[1]?.[0] as TemplateStringsArray).join('?');
    expect(history).toContain('INSERT INTO sales.manual_shipment_history');
    expect(query.mock.calls[1]).toContain(3);
  });

  it('fails when the row belongs to another tenant or the driver fails', async (): Promise<void> => {
    await expect(
      new PostgresCarrierShipmentRecordAdapter().record(
        input,
        txWith(vi.fn().mockResolvedValue([])),
      ),
    ).rejects.toBeInstanceOf(CarrierShipmentRecordException);
    await expect(
      new PostgresCarrierShipmentRecordAdapter().record(
        input,
        txWith(vi.fn().mockRejectedValue(new Error('x'))),
      ),
    ).rejects.toBeInstanceOf(CarrierShipmentRecordException);
  });
});

describe('supabase label storage adapter', (): void => {
  function client(
    upload: { error: unknown },
    signed: { data: { signedUrl: string } | null; error: unknown },
  ): { storage: LabelStorageClient; from: Query; upload: Query; createSignedUrl: Query } {
    const uploadFn = vi.fn().mockResolvedValue(upload);
    const createSignedUrl = vi.fn().mockResolvedValue(signed);
    const from = vi.fn().mockReturnValue({ upload: uploadFn, createSignedUrl });
    return { storage: { from } as LabelStorageClient, from, upload: uploadFn, createSignedUrl };
  }
  const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

  it('stores a private PDF under the tenant folder with a server-generated name', async (): Promise<void> => {
    const c = client({ error: null }, { data: null, error: null });
    const path = await new SupabaseLabelStorageAdapter(c.storage, (): string => LABEL_ID).put(
      TENANT,
      PDF,
    );
    expect(path).toBe(`${TENANT}/${LABEL_ID}.pdf`);
    expect(c.from).toHaveBeenCalledWith('shipment-labels');
    expect(c.upload).toHaveBeenCalledWith(path, PDF, {
      contentType: 'application/pdf',
      upsert: false,
    });
  });

  it('rejects invalid tenants, empty labels and upload errors', async (): Promise<void> => {
    const ok = client({ error: null }, { data: null, error: null });
    await expect(
      new SupabaseLabelStorageAdapter(ok.storage).put('../evil', PDF),
    ).rejects.toBeInstanceOf(LabelStorageException);
    await expect(
      new SupabaseLabelStorageAdapter(ok.storage).put(TENANT, new Uint8Array()),
    ).rejects.toBeInstanceOf(LabelStorageException);
    const failing = client({ error: { message: 'denied' } }, { data: null, error: null });
    await expect(
      new SupabaseLabelStorageAdapter(failing.storage).put(TENANT, PDF),
    ).rejects.toBeInstanceOf(LabelStorageException);
  });

  it('issues short-lived signed URLs only for label paths', async (): Promise<void> => {
    const c = client({ error: null }, { data: { signedUrl: 'https://signed' }, error: null });
    const adapter = new SupabaseLabelStorageAdapter(c.storage);
    expect(await adapter.signedUrl(`${TENANT}/${LABEL_ID}.pdf`, 60)).toBe('https://signed');
    expect(c.createSignedUrl).toHaveBeenCalledWith(`${TENANT}/${LABEL_ID}.pdf`, 60);
    await expect(adapter.signedUrl('../x.pdf', 60)).rejects.toBeInstanceOf(LabelStorageException);
    await expect(adapter.signedUrl(`${TENANT}/${LABEL_ID}.pdf`, 3600)).rejects.toBeInstanceOf(
      LabelStorageException,
    );
    const failing = client({ error: null }, { data: null, error: { message: 'x' } });
    await expect(
      new SupabaseLabelStorageAdapter(failing.storage).signedUrl(`${TENANT}/${LABEL_ID}.pdf`, 60),
    ).rejects.toBeInstanceOf(LabelStorageException);
  });
});

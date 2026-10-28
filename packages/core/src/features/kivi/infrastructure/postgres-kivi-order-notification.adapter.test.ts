import type postgres from 'postgres';
import { describe, expect, it, vi } from 'vitest';
import { PostgresKiviOrderNotificationAdapter } from '@/kivi/infrastructure/postgres-kivi-order-notification.adapter';

describe('Kivi notification recipient projection', (): void => {
  it('uses a captured recipient even when the current profile phone is no longer international', async (): Promise<void> => {
    const sql = vi.fn().mockResolvedValue([
      {
        base_url: 'https://api.kivi.example',
        connection_id: crypto.randomUUID(),
        token_ciphertext: 'credential',
        token_key_version: 1,
        phone: '0999999999',
        order_number: 'CHANGED',
        payload_ciphertext: 'snapshot',
        payload_key_version: 1,
      },
    ]) as unknown as postgres.Sql<Record<string, unknown>>;
    const result = await new PostgresKiviOrderNotificationAdapter(sql, {
      encrypt: vi.fn(),
      decrypt: (encrypted): string =>
        encrypted.ciphertext === 'snapshot'
          ? JSON.stringify({ phone: '593999999999', orderNumber: 'ORD-ORIGINAL' })
          : 'kc_token',
    }).find(event);
    expect(result).toMatchObject({ phone: '593999999999', orderNumber: 'ORD-ORIGINAL' });
  });
  const event = {
    messageId: crypto.randomUUID(),
    tenantId: crypto.randomUUID(),
    aggregateId: crypto.randomUUID(),
    aggregateType: 'Order',
    eventType: 'OrderShippedEvent',
    occurredAt: new Date().toISOString(),
    payload: {},
  };
  it.each(['+593 99 999 9999', '+593-99-999-9999'])(
    'canonicalizes supported presentation separators in %s',
    async (phone: string): Promise<void> => {
      const sql = vi
        .fn()
        .mockResolvedValueOnce([
          {
            base_url: 'https://api.kivi.example',
            connection_id: crypto.randomUUID(),
            token_ciphertext: 'encrypted',
            token_key_version: 1,
            phone,
            order_number: 'ORD-1',
          },
        ])
        .mockResolvedValueOnce([
          {
            payload_ciphertext: JSON.stringify({ phone: '593999999999', orderNumber: 'ORD-1' }),
            payload_key_version: 1,
          },
        ]) as unknown as postgres.Sql<Record<string, unknown>>;
      const result = await new PostgresKiviOrderNotificationAdapter(sql, {
        encrypt: (value: string): { ciphertext: string; keyVersion: number } => ({
          ciphertext: value,
          keyVersion: 1,
        }),
        decrypt: (encrypted): string =>
          encrypted.ciphertext === 'encrypted' ? 'kc_test' : encrypted.ciphertext,
      }).find(event);
      expect(result?.phone).toBe('593999999999');
    },
  );
  it('does not guess a country code for a local number', async (): Promise<void> => {
    const sql = vi.fn().mockResolvedValue([{ phone: '0999999999' }]) as unknown as postgres.Sql<
      Record<string, unknown>
    >;
    await expect(
      new PostgresKiviOrderNotificationAdapter(sql, { encrypt: vi.fn(), decrypt: vi.fn() }).find(
        event,
      ),
    ).rejects.toMatchObject({ name: 'NotificationPermanentException' });
  });
});

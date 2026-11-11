import type postgres from 'postgres';
import { describe, expect, it, vi } from 'vitest';
import { PostgresKiviOrderNotificationAdapter } from '@/kivi/infrastructure/postgres-kivi-order-notification.adapter';
import type { NotificationCopies } from '@/notifications/application/ports/out/notification.ports';

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
  it('does not guess a country code: a local checkout phone is left out so Kivi uses the linked chat', async (): Promise<void> => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([
        {
          base_url: 'https://api.kivi.example',
          connection_id: crypto.randomUUID(),
          token_ciphertext: 'encrypted',
          token_key_version: 1,
          phone: '0999999999',
          order_number: 'ORD-1',
        },
      ])
      .mockResolvedValueOnce([
        {
          payload_ciphertext: JSON.stringify({ phone: null, orderNumber: 'ORD-1' }),
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
    expect(result).toMatchObject({ phone: null, orderNumber: 'ORD-1' });
  });
  describe('WhatsApp text', (): void => {
    const copies = {
      es: {
        subjects: { processing: 'Pedido en preparación: {orderNumber}' },
        body: '{tenantName}: {status}.',
        intros: { processing: 'En {tenantName} estamos preparando tu pedido.' },
      },
      en: { subjects: {}, body: '' },
    } as unknown as NotificationCopies;
    const sourceRow = {
      base_url: 'https://api.kivi.example',
      connection_id: crypto.randomUUID(),
      token_ciphertext: 'encrypted',
      token_key_version: 1,
      phone: '+593999999999',
      order_number: 'ORD-1',
    };
    const cipher = {
      encrypt: (value: string): { ciphertext: string; keyVersion: number } => ({
        ciphertext: value,
        keyVersion: 1,
      }),
      decrypt: (encrypted: { ciphertext: string }): string =>
        encrypted.ciphertext === 'encrypted' ? 'kc_test' : encrypted.ciphertext,
    };
    const processing = { ...event, eventType: 'OrderProcessingEvent' };

    it('is not built when no wording is configured, so Kivi writes its own text', async (): Promise<void> => {
      const sql = vi
        .fn()
        .mockResolvedValueOnce([sourceRow])
        .mockResolvedValueOnce([
          {
            payload_ciphertext: JSON.stringify({ phone: '593999999999', orderNumber: 'ORD-1' }),
            payload_key_version: 1,
          },
        ]) as unknown as postgres.Sql<Record<string, unknown>>;
      const result = await new PostgresKiviOrderNotificationAdapter(sql, cipher).find(processing);
      expect(result).not.toHaveProperty('message');
    });

    it('degrades to headline and intro when the order projection cannot be read', async (): Promise<void> => {
      const sql = vi
        .fn()
        .mockResolvedValueOnce([sourceRow])
        .mockResolvedValueOnce([
          {
            payload_ciphertext: JSON.stringify({ phone: '593999999999', orderNumber: 'ORD-1' }),
            payload_key_version: 1,
          },
        ])
        .mockRejectedValueOnce(new Error('projection unavailable')) as unknown as postgres.Sql<
        Record<string, unknown>
      >;
      const result = await new PostgresKiviOrderNotificationAdapter(sql, cipher, {
        copies,
        locale: 'es',
      }).find(processing);
      expect(result?.message).toBe(
        '*Pedido en preparación: ORD-1*\n\nEn {tenantName} estamos preparando tu pedido.',
      );
    });
  });
});

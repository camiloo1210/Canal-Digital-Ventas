import type postgres from 'postgres';
import { describe, expect, it, vi } from 'vitest';
import { PostgresKiviStoreWidgetReadRepository } from '@/kivi/infrastructure/postgres-kivi-store-widget-read.repository';

describe('store widget tenant projection', (): void => {
  it('returns only the public key of the store resolved by slug', async (): Promise<void> => {
    const row = {
      tenant_id: crypto.randomUUID(),
      base_url: 'https://api.kivi.example',
      connection_id: crypto.randomUUID(),
      token_ciphertext: 'encrypted',
      token_key_version: 1,
    };
    const sql = vi.fn().mockResolvedValue([row]) as unknown as postgres.Sql<
      Record<string, unknown>
    >;
    const readWidget = vi.fn().mockResolvedValue({ widgetKey: 'pk_live_' + 'A'.repeat(32) });
    const result = await new PostgresKiviStoreWidgetReadRepository(
      sql,
      { encrypt: vi.fn(), decrypt: (): string => 'kc_secret' },
      { readWidget },
    ).findForStoreSlug('store-a');
    expect(result).toEqual({ widgetKey: 'pk_live_' + 'A'.repeat(32) });
    expect(JSON.stringify(result)).not.toContain('kc_secret');
    expect(readWidget).toHaveBeenCalledWith({
      baseUrl: row.base_url,
      connectionId: row.connection_id,
      token: 'kc_secret',
    });
  });
  it('does not mount the global widget for an unlinked store', async (): Promise<void> => {
    const sql = vi.fn().mockResolvedValue([]) as unknown as postgres.Sql<Record<string, unknown>>;
    const readWidget = vi.fn();
    expect(
      await new PostgresKiviStoreWidgetReadRepository(
        sql,
        { encrypt: vi.fn(), decrypt: vi.fn() },
        { readWidget },
      ).findForStoreSlug('unlinked'),
    ).toBeNull();
    expect(readWidget).not.toHaveBeenCalled();
  });
});

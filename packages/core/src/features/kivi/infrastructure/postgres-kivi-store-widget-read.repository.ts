import type postgres from 'postgres';
import type {
  KiviStoreWidget,
  KiviStoreWidgetReadPort,
} from '@/kivi/application/ports/out/kivi-store-widget-read.port';
import type { KiviTokenCipherPort } from '@/kivi/application/ports/out/kivi-token-cipher.port';
import type { KiviTarget } from '@/kivi/application/ports/out/kivi-catalog-gateway.port';
import { KiviGatewayException } from '@/kivi/application/exceptions/kivi-gateway.exception';

export class PostgresKiviStoreWidgetReadRepository implements KiviStoreWidgetReadPort {
  public constructor(
    private readonly sql: postgres.Sql<Record<string, unknown>>,
    private readonly cipher: KiviTokenCipherPort,
    private readonly gateway: { readWidget(target: KiviTarget): Promise<KiviStoreWidget | null> },
  ) {}
  public async findForStoreSlug(slug: string): Promise<KiviStoreWidget | null> {
    try {
      const [row] = await this.sql<
        {
          tenant_id: string;
          base_url: string;
          connection_id: string;
          token_ciphertext: string;
          token_key_version: number;
        }[]
      >`
        SELECT k.tenant_id, k.base_url, k.connection_id, k.token_ciphertext, k.token_key_version
        FROM core.kivi_connections k JOIN core.tenants t ON t.id=k.tenant_id
        WHERE t.slug=${slug} AND t.status='active' AND k.status <> 'unlinked' AND k.token_ciphertext IS NOT NULL
      `;
      if (!row) return null;
      return await this.gateway.readWidget({
        baseUrl: row.base_url,
        connectionId: row.connection_id,
        token: this.cipher.decrypt(
          { ciphertext: row.token_ciphertext, keyVersion: row.token_key_version },
          row.tenant_id,
        ),
      });
    } catch {
      throw new KiviGatewayException('transient', 0);
    }
  }
}

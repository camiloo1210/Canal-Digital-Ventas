import type { KiviConnectionRepositoryPort } from '@/kivi/application/ports/out/kivi-connection-repository.port';
import type { KiviSecretResolverPort } from '@/kivi/application/ports/out/kivi-secret-resolver.port';
import type { KiviToolsGatewayPort } from '@/kivi/application/ports/out/kivi-tools-gateway.port';
import type { KiviTarget } from '@/kivi/application/ports/out/kivi-catalog-gateway.port';
import type { TransactionManagerPort } from '@/shared/application/ports/out/transaction-manager.port';
import { publicHttpsOrigin } from '@/kivi/application/kivi-public-origin';
import {
  KIVI_TOOL_CATALOG,
  KIVI_TOOLS_PATH,
  type KiviToolDefinition,
} from '@/kivi/application/kivi-tool-catalog';

export interface RegisterKiviToolsDto {
  /** Actor, used only to scope the read transaction. */
  userId: string;
  tenantId: string;
  publicOrigin: string | null;
}

export type RegisterKiviToolsOutcome =
  'registered' | 'skipped_no_public_origin' | 'no_connection' | 'not_available' | 'failed';

export interface KiviToolsRegistrar {
  execute(dto: RegisterKiviToolsDto): Promise<RegisterKiviToolsOutcome>;
}

/**
 * Registers the read-only connection tools of Canal with Kivi (full replace, idempotent). Never
 * throws: a failure here must not break pairing or sync, so it is reported as an outcome.
 */
export class RegisterKiviToolsUseCase implements KiviToolsRegistrar {
  public constructor(
    private readonly repository: KiviConnectionRepositoryPort,
    private readonly transactions: TransactionManagerPort,
    private readonly secrets: KiviSecretResolverPort,
    private readonly gateway: KiviToolsGatewayPort,
    /** Derives the per-store tools key (hex). Its result is secret. */
    private readonly deriveToolsKey: (tenantId: string) => string,
    private readonly tools: readonly KiviToolDefinition[] = KIVI_TOOL_CATALOG,
    private readonly logger: { warn(message: string): void } = {
      warn: (message: string): void => console.warn(`[Kivi] ${message}`),
    },
  ) {}

  public async execute(dto: RegisterKiviToolsDto): Promise<RegisterKiviToolsOutcome> {
    try {
      const origin = publicHttpsOrigin(dto.publicOrigin);
      if (origin === null) return 'skipped_no_public_origin';
      const target = await this.transactions.runInTransaction(
        async (tx): Promise<KiviTarget | null> => {
          const connection = await this.repository.findByTenant(dto.tenantId, tx);
          if (!connection || !connection.isSyncing()) return null;
          const token = this.secrets.resolve(connection);
          if (!token) return null;
          return {
            baseUrl: connection.getBaseUrl().getValue(),
            connectionId: connection.getConnectionId(),
            token,
          };
        },
        { userId: dto.userId, tenantId: dto.tenantId },
      );
      if (target === null) return 'no_connection';
      const result = await this.gateway.registerTools(target, {
        baseUrl: `${origin}${KIVI_TOOLS_PATH}`,
        key: this.deriveToolsKey(dto.tenantId),
        tools: this.tools,
      });
      return result.available ? 'registered' : 'not_available';
    } catch (error: unknown) {
      // Class name only: messages may echo configuration.
      this.logger.warn(
        `Tools registration failed (${error instanceof Error ? error.name : 'unknown'}).`,
      );
      return 'failed';
    }
  }
}

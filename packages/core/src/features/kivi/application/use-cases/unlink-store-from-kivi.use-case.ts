import type { UnlinkStoreFromKiviDto } from '@/kivi/application/dtos/kivi-connection.dto';
import type { KiviTarget } from '@/kivi/application/ports/out/kivi-catalog-gateway.port';
import type { KiviConnectionRepositoryPort } from '@/kivi/application/ports/out/kivi-connection-repository.port';
import type { KiviPairingGatewayPort } from '@/kivi/application/ports/out/kivi-pairing-gateway.port';
import type { KiviTokenCipherPort } from '@/kivi/application/ports/out/kivi-token-cipher.port';
import type { TransactionManagerPort } from '@/shared/application/ports/out/transaction-manager.port';
import type { KiviConnection } from '@/kivi/domain/entities/kivi-connection.entity';
import { KiviLinkForbiddenException } from '@/kivi/application/exceptions/kivi-link-forbidden.exception';
import { KiviConnectionNotFoundException } from '@/kivi/application/exceptions/kivi-connection-not-found.exception';
import { KiviPairingException } from '@/kivi/application/exceptions/kivi-pairing.exception';

export interface UnlinkStoreFromKiviDependencies {
  gateway: KiviPairingGatewayPort;
  cipher: KiviTokenCipherPort;
  /** Receives static strings only: never tokens, URLs or ids. */
  logger: { warn(message: string): void };
}

export class UnlinkStoreFromKiviUseCase {
  public constructor(
    private readonly repository: KiviConnectionRepositoryPort,
    private readonly transactions: TransactionManagerPort,
    private readonly revocation: UnlinkStoreFromKiviDependencies,
  ) {}

  public async execute(dto: UnlinkStoreFromKiviDto): Promise<void> {
    const revocable = await this.transactions.runInTransaction(
      async (tx): Promise<KiviTarget | null> => {
        if (!(await this.repository.isStoreOwner(dto.userId, dto.tenantId, tx))) {
          throw new KiviLinkForbiddenException();
        }
        const connection = await this.repository.findByTenant(dto.tenantId, tx);
        if (!connection) throw new KiviConnectionNotFoundException();
        const target = this.revocationTarget(connection, dto.tenantId);
        connection.unlink(); // also wipes the ciphertext
        await this.repository.save(connection, tx);
        return target;
      },
      { userId: dto.userId, tenantId: dto.tenantId },
    );
    // After commit and best effort: Kivi being down must never block a local disconnect.
    if (revocable) await this.revoke(revocable);
  }

  private revocationTarget(connection: KiviConnection, tenantId: string): KiviTarget | null {
    const encrypted = connection.getEncryptedToken();
    if (!encrypted) return null; // legacy env-var credential: nothing stored to revoke with
    try {
      return {
        baseUrl: connection.getBaseUrl().getValue(),
        connectionId: connection.getConnectionId(),
        token: this.revocation.cipher.decrypt(encrypted, tenantId),
      };
    } catch {
      this.revocation.logger.warn('Kivi revoke skipped: stored credential could not be read');
      return null;
    }
  }

  private async revoke(target: KiviTarget): Promise<void> {
    try {
      await this.revocation.gateway.revokeSelf(target);
    } catch (error: unknown) {
      const classification = error instanceof KiviPairingException ? error.failure : 'unexpected';
      this.revocation.logger.warn(`Kivi revoke failed (${classification}); disconnected locally`);
    }
  }
}

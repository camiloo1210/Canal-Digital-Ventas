import type { PairStoreWithKiviDto } from '@/kivi/application/dtos/kivi-connection.dto';
import type { KiviConnectionRepositoryPort } from '@/kivi/application/ports/out/kivi-connection-repository.port';
import type { KiviPairingGatewayPort } from '@/kivi/application/ports/out/kivi-pairing-gateway.port';
import type { KiviTokenCipherPort } from '@/kivi/application/ports/out/kivi-token-cipher.port';
import type { TransactionManagerPort } from '@/shared/application/ports/out/transaction-manager.port';
import { KiviLinkForbiddenException } from '@/kivi/application/exceptions/kivi-link-forbidden.exception';
import { InvalidKiviPairingCodeException } from '@/kivi/application/exceptions/invalid-kivi-pairing-code.exception';
import { KiviConnection } from '@/kivi/domain/entities/kivi-connection.entity';
import { InvalidKiviConnectionException } from '@/kivi/domain/exceptions/invalid-kivi-connection.exception';
import type { KiviBaseUrl } from '@/kivi/domain/value-objects/kivi-base-url.vo';

const PAIRING_CODE = /^kvp_[A-Za-z0-9_-]{8,200}$/;

/**
 * Connects a store to Kivi with a one-time pairing code. The owner never handles a token: the
 * code is exchanged server-side, the issued token is encrypted (bound to the store) and
 * persisted as pending so the initial load starts automatically. Resolves with nothing.
 */
export class PairStoreWithKiviUseCase {
  public constructor(
    private readonly repository: KiviConnectionRepositoryPort,
    private readonly transactions: TransactionManagerPort,
    private readonly gateway: KiviPairingGatewayPort,
    private readonly cipher: KiviTokenCipherPort,
    private readonly baseUrl: KiviBaseUrl,
  ) {}

  public async execute(dto: PairStoreWithKiviDto): Promise<void> {
    const code = dto.code.trim();
    if (!PAIRING_CODE.test(code)) throw new InvalidKiviPairingCodeException();
    const context = { userId: dto.userId, tenantId: dto.tenantId };

    // No network call while holding a transaction; ownership is re-checked when persisting.
    const storeName = await this.transactions.runInTransaction(async (tx): Promise<string> => {
      await this.assertOwner(dto, tx);
      const name = await this.repository.findStoreName(dto.tenantId, tx);
      if (!name) throw new InvalidKiviConnectionException('The store does not exist.');
      return name;
    }, context);

    const issued = await this.gateway.exchange({
      code,
      externalTenantId: dto.tenantId,
      name: storeName,
    });
    const connection = KiviConnection.pair({
      tenantId: dto.tenantId,
      baseUrl: this.baseUrl,
      connectionId: issued.connectionId,
      encryptedToken: this.cipher.encrypt(issued.token, dto.tenantId),
    });

    await this.transactions.runInTransaction(async (tx): Promise<void> => {
      await this.assertOwner(dto, tx);
      await this.repository.save(connection, tx);
    }, context);
  }

  private async assertOwner(
    dto: PairStoreWithKiviDto,
    tx: Parameters<KiviConnectionRepositoryPort['isStoreOwner']>[2],
  ): Promise<void> {
    if (!(await this.repository.isStoreOwner(dto.userId, dto.tenantId, tx))) {
      throw new KiviLinkForbiddenException();
    }
  }
}

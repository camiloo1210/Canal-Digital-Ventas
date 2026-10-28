import type { LinkStoreToKiviDto } from '@/kivi/application/dtos/kivi-connection.dto';
import type { KiviConnectionRepositoryPort } from '@/kivi/application/ports/out/kivi-connection-repository.port';
import type { TransactionManagerPort } from '@/shared/application/ports/out/transaction-manager.port';
import { KiviLinkForbiddenException } from '@/kivi/application/exceptions/kivi-link-forbidden.exception';
import { KiviConnection } from '@/kivi/domain/entities/kivi-connection.entity';
import { KiviBaseUrl, type KiviBaseUrlOptions } from '@/kivi/domain/value-objects/kivi-base-url.vo';
import { KiviSecretRef } from '@/kivi/domain/value-objects/kivi-secret-ref.vo';

export class LinkStoreToKiviUseCase {
  public constructor(
    private readonly repository: KiviConnectionRepositoryPort,
    private readonly transactions: TransactionManagerPort,
    private readonly urlOptions: KiviBaseUrlOptions,
  ) {}

  public async execute(dto: LinkStoreToKiviDto): Promise<void> {
    const baseUrl = KiviBaseUrl.from(dto.baseUrl, this.urlOptions);
    const secretRef = KiviSecretRef.from(dto.secretRef);
    await this.transactions.runInTransaction(
      async (tx): Promise<void> => {
        if (!(await this.repository.isStoreOwner(dto.userId, dto.tenantId, tx))) {
          throw new KiviLinkForbiddenException();
        }
        const connection = KiviConnection.link({
          tenantId: dto.tenantId,
          baseUrl,
          connectionId: dto.connectionId,
          secretRef,
        });
        await this.repository.save(connection, tx);
      },
      { userId: dto.userId, tenantId: dto.tenantId },
    );
  }
}

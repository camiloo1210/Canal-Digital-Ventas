import type { RequestKiviSyncDto } from '@/kivi/application/dtos/kivi-connection.dto';
import type { KiviConnectionRepositoryPort } from '@/kivi/application/ports/out/kivi-connection-repository.port';
import type { TransactionManagerPort } from '@/shared/application/ports/out/transaction-manager.port';
import { KiviLinkForbiddenException } from '@/kivi/application/exceptions/kivi-link-forbidden.exception';
import { KiviConnectionNotFoundException } from '@/kivi/application/exceptions/kivi-connection-not-found.exception';

/** "Sync now": flags the connection so the next worker cycle reconciles the whole catalog. */
export class RequestKiviSyncUseCase {
  public constructor(
    private readonly repository: KiviConnectionRepositoryPort,
    private readonly transactions: TransactionManagerPort,
  ) {}

  public async execute(dto: RequestKiviSyncDto): Promise<void> {
    await this.transactions.runInTransaction(
      async (tx): Promise<void> => {
        if (!(await this.repository.isStoreOwner(dto.userId, dto.tenantId, tx))) {
          throw new KiviLinkForbiddenException();
        }
        const connection = await this.repository.findByTenant(dto.tenantId, tx);
        if (!connection) throw new KiviConnectionNotFoundException();
        connection.flagNeedsReconcile();
        await this.repository.save(connection, tx);
      },
      { userId: dto.userId, tenantId: dto.tenantId },
    );
  }
}

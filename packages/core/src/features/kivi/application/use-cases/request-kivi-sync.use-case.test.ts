import { describe, expect, it } from 'vitest';
import { RequestKiviSyncUseCase } from '@/kivi/application/use-cases/request-kivi-sync.use-case';
import type { KiviConnectionRepositoryPort } from '@/kivi/application/ports/out/kivi-connection-repository.port';
import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';
import type { KiviConnection } from '@/kivi/domain/entities/kivi-connection.entity';
import { KiviLinkForbiddenException } from '@/kivi/application/exceptions/kivi-link-forbidden.exception';
import { KiviConnectionNotFoundException } from '@/kivi/application/exceptions/kivi-connection-not-found.exception';
import { InvalidKiviConnectionException } from '@/kivi/domain/exceptions/invalid-kivi-connection.exception';
import { TENANT, connection } from '@/kivi/application/kivi-test-doubles';

const OWNER = '33333333-3333-4333-8333-333333333333';

class MemoryRepo implements KiviConnectionRepositoryPort {
  public saved: KiviConnection | null = null;
  public constructor(
    private readonly owner: string | null,
    private readonly current: KiviConnection | null,
  ) {}
  public async isStoreOwner(userId: string): Promise<boolean> {
    return this.owner === userId;
  }
  public async findStoreName(): Promise<string | null> {
    return 'Tienda';
  }
  public async findByTenant(): Promise<KiviConnection | null> {
    return this.current;
  }
  public async save(value: KiviConnection): Promise<void> {
    this.saved = value;
  }
}

const tx: TransactionManagerPort = {
  runInTransaction: async <T>(op: (c: TransactionContext) => Promise<T>): Promise<T> =>
    op({ executeNative: async (): Promise<never> => Promise.reject(new Error('unused')) }),
};

describe('RequestKiviSyncUseCase', (): void => {
  it('flags an active connection for reconciliation', async (): Promise<void> => {
    const repo = new MemoryRepo(OWNER, connection('active'));
    await new RequestKiviSyncUseCase(repo, tx).execute({ userId: OWNER, tenantId: TENANT });
    expect(repo.saved?.getStatus()).toBe('needs_reconcile');
  });

  it('keeps a pending connection pending so the initial load still runs', async (): Promise<void> => {
    const repo = new MemoryRepo(OWNER, connection('pending'));
    await new RequestKiviSyncUseCase(repo, tx).execute({ userId: OWNER, tenantId: TENANT });
    expect(repo.saved?.getStatus()).toBe('pending');
  });

  it('rejects non-owners without persisting', async (): Promise<void> => {
    const repo = new MemoryRepo('someone-else', connection('active'));
    await expect(
      new RequestKiviSyncUseCase(repo, tx).execute({ userId: OWNER, tenantId: TENANT }),
    ).rejects.toBeInstanceOf(KiviLinkForbiddenException);
    expect(repo.saved).toBeNull();
  });

  it('rejects stores without a connection and unlinked connections', async (): Promise<void> => {
    await expect(
      new RequestKiviSyncUseCase(new MemoryRepo(OWNER, null), tx).execute({
        userId: OWNER,
        tenantId: TENANT,
      }),
    ).rejects.toBeInstanceOf(KiviConnectionNotFoundException);
    const unlinked = connection('active');
    unlinked.unlink();
    await expect(
      new RequestKiviSyncUseCase(new MemoryRepo(OWNER, unlinked), tx).execute({
        userId: OWNER,
        tenantId: TENANT,
      }),
    ).rejects.toBeInstanceOf(InvalidKiviConnectionException);
  });
});

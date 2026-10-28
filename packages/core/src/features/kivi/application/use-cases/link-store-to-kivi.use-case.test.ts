import { describe, expect, it } from 'vitest';
import { LinkStoreToKiviUseCase } from '@/kivi/application/use-cases/link-store-to-kivi.use-case';
import { UnlinkStoreFromKiviUseCase } from '@/kivi/application/use-cases/unlink-store-from-kivi.use-case';
import type { KiviConnectionRepositoryPort } from '@/kivi/application/ports/out/kivi-connection-repository.port';
import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';
import type { KiviConnection } from '@/kivi/domain/entities/kivi-connection.entity';
import { KiviLinkForbiddenException } from '@/kivi/application/exceptions/kivi-link-forbidden.exception';
import { KiviConnectionNotFoundException } from '@/kivi/application/exceptions/kivi-connection-not-found.exception';
import { InvalidKiviConnectionException } from '@/kivi/domain/exceptions/invalid-kivi-connection.exception';

class KiviPortProbeException extends Error {}

const TENANT = '11111111-1111-4111-8111-111111111111';
const OWNER = '33333333-3333-4333-8333-333333333333';
const dto = {
  userId: OWNER,
  tenantId: TENANT,
  baseUrl: 'https://api.kivi.example',
  connectionId: '22222222-2222-4222-8222-222222222222',
  secretRef: 'KIVI_CONNECTION_TOKEN_STORE',
};

class MemoryRepo implements KiviConnectionRepositoryPort {
  public saved: KiviConnection | null = null;
  public constructor(private readonly owner: string | null) {}
  public async isStoreOwner(userId: string): Promise<boolean> {
    return this.owner === userId;
  }
  public async findStoreName(): Promise<string | null> {
    return 'Tienda';
  }
  public async findByTenant(): Promise<KiviConnection | null> {
    return this.saved;
  }
  public async save(connection: KiviConnection): Promise<void> {
    this.saved = connection;
  }
}

const tx: TransactionManagerPort = {
  runInTransaction: async <T>(op: (c: TransactionContext) => Promise<T>): Promise<T> =>
    op({ executeNative: async (): Promise<never> => Promise.reject(new Error('unused')) }),
};

const noRevoke = {
  gateway: {
    exchange: async (): Promise<never> => Promise.reject(new Error('unused')),
    revokeSelf: async (): Promise<void> => {},
  },
  cipher: {
    encrypt: (): never => {
      throw new KiviPortProbeException('unused');
    },
    decrypt: (): never => {
      throw new KiviPortProbeException('unused');
    },
  },
  logger: { warn: (): void => {} },
};

describe('LinkStoreToKiviUseCase', (): void => {
  it('links a store for its owner as pending the initial load', async (): Promise<void> => {
    const repo = new MemoryRepo(OWNER);
    await new LinkStoreToKiviUseCase(repo, tx, {}).execute(dto);
    expect(repo.saved?.getStatus()).toBe('pending');
    expect(repo.saved?.getSecretRef()?.getValue()).toBe('KIVI_CONNECTION_TOKEN_STORE');
  });

  it('rejects non-owners without persisting', async (): Promise<void> => {
    const repo = new MemoryRepo('someone-else');
    await expect(new LinkStoreToKiviUseCase(repo, tx, {}).execute(dto)).rejects.toBeInstanceOf(
      KiviLinkForbiddenException,
    );
    expect(repo.saved).toBeNull();
  });

  it('rejects unsafe base URLs and raw credentials in place of a secret reference', async (): Promise<void> => {
    const repo = new MemoryRepo(OWNER);
    const useCase = new LinkStoreToKiviUseCase(repo, tx, {});
    await expect(
      useCase.execute({ ...dto, baseUrl: 'https://169.254.169.254' }),
    ).rejects.toBeInstanceOf(InvalidKiviConnectionException);
    await expect(
      useCase.execute({ ...dto, secretRef: 'kc_' + 'a'.repeat(43) }),
    ).rejects.toBeInstanceOf(InvalidKiviConnectionException);
    expect(repo.saved).toBeNull();
  });
});

describe('UnlinkStoreFromKiviUseCase', (): void => {
  it('lets the owner unlink', async (): Promise<void> => {
    const repo = new MemoryRepo(OWNER);
    await new LinkStoreToKiviUseCase(repo, tx, {}).execute(dto);
    await new UnlinkStoreFromKiviUseCase(repo, tx, noRevoke).execute({
      userId: OWNER,
      tenantId: TENANT,
    });
    expect(repo.saved?.getStatus()).toBe('unlinked');
  });

  it('rejects non-owners and unknown links', async (): Promise<void> => {
    const stranger = new MemoryRepo('x');
    await expect(
      new UnlinkStoreFromKiviUseCase(stranger, tx, noRevoke).execute({
        userId: OWNER,
        tenantId: TENANT,
      }),
    ).rejects.toBeInstanceOf(KiviLinkForbiddenException);
    const empty = new MemoryRepo(OWNER);
    await expect(
      new UnlinkStoreFromKiviUseCase(empty, tx, noRevoke).execute({
        userId: OWNER,
        tenantId: TENANT,
      }),
    ).rejects.toBeInstanceOf(KiviConnectionNotFoundException);
  });
});

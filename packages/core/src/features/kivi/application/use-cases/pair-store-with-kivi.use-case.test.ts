import { describe, expect, it, vi } from 'vitest';
import { PairStoreWithKiviUseCase } from '@/kivi/application/use-cases/pair-store-with-kivi.use-case';
import { UnlinkStoreFromKiviUseCase } from '@/kivi/application/use-cases/unlink-store-from-kivi.use-case';
import type { KiviConnectionRepositoryPort } from '@/kivi/application/ports/out/kivi-connection-repository.port';
import type {
  KiviPairingExchangeRequest,
  KiviPairingExchangeResult,
  KiviPairingGatewayPort,
} from '@/kivi/application/ports/out/kivi-pairing-gateway.port';
import type { KiviTokenCipherPort } from '@/kivi/application/ports/out/kivi-token-cipher.port';
import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';
import type { KiviConnection } from '@/kivi/domain/entities/kivi-connection.entity';
import { KiviBaseUrl } from '@/kivi/domain/value-objects/kivi-base-url.vo';
import { KiviLinkForbiddenException } from '@/kivi/application/exceptions/kivi-link-forbidden.exception';
import { KiviConnectionNotFoundException } from '@/kivi/application/exceptions/kivi-connection-not-found.exception';
import { InvalidKiviPairingCodeException } from '@/kivi/application/exceptions/invalid-kivi-pairing-code.exception';
import { KiviPairingException } from '@/kivi/application/exceptions/kivi-pairing.exception';

class KiviPortProbeException extends Error {}

const TENANT = '11111111-1111-4111-8111-111111111111';
const OWNER = '33333333-3333-4333-8333-333333333333';
const KIVI_CONNECTION = '22222222-2222-4222-8222-222222222222';
const CODE = 'kvp_' + 'c'.repeat(32);
const TOKEN = 'kc_' + 'Z'.repeat(43);

class MemoryRepo implements KiviConnectionRepositoryPort {
  public saved: KiviConnection | null = null;
  public saves = 0;
  public constructor(
    private readonly owner: string | null,
    private readonly storeName: string | null = 'Tienda Demo',
  ) {}
  public async isStoreOwner(userId: string): Promise<boolean> {
    return this.owner === userId;
  }
  public async findStoreName(): Promise<string | null> {
    return this.storeName;
  }
  public async findByTenant(): Promise<KiviConnection | null> {
    return this.saved;
  }
  public async save(connection: KiviConnection): Promise<void> {
    this.saves++;
    this.saved = connection;
  }
}

const tx: TransactionManagerPort = {
  runInTransaction: async <T>(op: (c: TransactionContext) => Promise<T>): Promise<T> =>
    op({ executeNative: async (): Promise<never> => Promise.reject(new Error('unused')) }),
};

/** Reversible fake: the "ciphertext" hides the token but records the tenant it was bound to. */
const cipher: KiviTokenCipherPort = {
  encrypt: (token, tenantId): { ciphertext: string; keyVersion: number } => ({
    ciphertext: `enc(${tenantId}|${token.length})`,
    keyVersion: 1,
  }),
  decrypt: (encrypted, tenantId): string => {
    if (!encrypted.ciphertext.startsWith(`enc(${tenantId}|`))
      throw new KiviPortProbeException('bad tenant');
    return TOKEN;
  },
};

function gateway(
  overrides: Partial<KiviPairingGatewayPort> = {},
): KiviPairingGatewayPort & { exchanged: KiviPairingExchangeRequest[] } {
  const exchanged: KiviPairingExchangeRequest[] = [];
  return {
    exchanged,
    exchange: async (request): Promise<KiviPairingExchangeResult> => {
      exchanged.push(request);
      return { connectionId: KIVI_CONNECTION, token: TOKEN, scopes: ['catalog'], expiresAt: null };
    },
    revokeSelf: async (): Promise<void> => {},
    ...overrides,
  };
}

const baseUrl = KiviBaseUrl.from('https://api.kivi.example');
const dto = { userId: OWNER, tenantId: TENANT, code: CODE };

describe('PairStoreWithKiviUseCase', (): void => {
  it('exchanges the code with the store tenant id and name, encrypts the token and persists pending', async (): Promise<void> => {
    const repo = new MemoryRepo(OWNER);
    const gw = gateway();
    await new PairStoreWithKiviUseCase(repo, tx, gw, cipher, baseUrl).execute(dto);
    expect(gw.exchanged).toEqual([{ code: CODE, externalTenantId: TENANT, name: 'Tienda Demo' }]);
    expect(repo.saved?.getStatus()).toBe('pending');
    expect(repo.saved?.getConnectionId()).toBe(KIVI_CONNECTION);
    expect(repo.saved?.getBaseUrl().getValue()).toBe('https://api.kivi.example');
    expect(repo.saved?.getSecretRef()).toBeNull();
    const stored = repo.saved?.getEncryptedToken();
    expect(stored?.ciphertext).toBe(`enc(${TENANT}|${TOKEN.length})`);
    expect(JSON.stringify(stored)).not.toContain(TOKEN);
  });

  it('returns nothing, so the token can never reach a caller', async (): Promise<void> => {
    const result = await new PairStoreWithKiviUseCase(
      new MemoryRepo(OWNER),
      tx,
      gateway(),
      cipher,
      baseUrl,
    ).execute(dto);
    expect(result).toBeUndefined();
  });

  it('trims the code and rejects malformed codes and raw tokens before any network call', async (): Promise<void> => {
    const repo = new MemoryRepo(OWNER);
    const gw = gateway();
    const useCase = new PairStoreWithKiviUseCase(repo, tx, gw, cipher, baseUrl);
    for (const code of [
      '',
      'kvp_',
      'kc_' + 'a'.repeat(43),
      'nope',
      'kvp_ has space',
      `kvp_${'a'.repeat(300)}`,
    ]) {
      await expect(useCase.execute({ ...dto, code })).rejects.toBeInstanceOf(
        InvalidKiviPairingCodeException,
      );
    }
    expect(gw.exchanged).toHaveLength(0);
    await useCase.execute({ ...dto, code: `  ${CODE}\n` });
    expect(gw.exchanged[0].code).toBe(CODE);
  });

  it('denies non-owners before calling Kivi', async (): Promise<void> => {
    const repo = new MemoryRepo('someone-else');
    const gw = gateway();
    await expect(
      new PairStoreWithKiviUseCase(repo, tx, gw, cipher, baseUrl).execute(dto),
    ).rejects.toBeInstanceOf(KiviLinkForbiddenException);
    expect(gw.exchanged).toHaveLength(0);
    expect(repo.saved).toBeNull();
  });

  it('propagates Kivi failures without persisting anything', async (): Promise<void> => {
    const repo = new MemoryRepo(OWNER);
    const gw = gateway({
      exchange: async (): Promise<never> => {
        throw new KiviPairingException('invalid_or_expired_code');
      },
    });
    await expect(
      new PairStoreWithKiviUseCase(repo, tx, gw, cipher, baseUrl).execute(dto),
    ).rejects.toMatchObject({ failure: 'invalid_or_expired_code' });
    expect(repo.saves).toBe(0);
  });
});

describe('UnlinkStoreFromKiviUseCase with a paired connection', (): void => {
  async function paired(repo: MemoryRepo): Promise<void> {
    await new PairStoreWithKiviUseCase(repo, tx, gateway(), cipher, baseUrl).execute(dto);
  }

  it('revokes the token at Kivi and wipes the ciphertext', async (): Promise<void> => {
    const repo = new MemoryRepo(OWNER);
    await paired(repo);
    const revokeSelf = vi.fn().mockResolvedValue(undefined);
    await new UnlinkStoreFromKiviUseCase(repo, tx, {
      gateway: gateway({ revokeSelf }),
      cipher,
      logger: { warn: vi.fn() },
    }).execute({ userId: OWNER, tenantId: TENANT });
    expect(revokeSelf).toHaveBeenCalledWith({
      baseUrl: 'https://api.kivi.example',
      connectionId: KIVI_CONNECTION,
      token: TOKEN,
    });
    expect(repo.saved?.getStatus()).toBe('unlinked');
    expect(repo.saved?.getEncryptedToken()).toBeNull();
  });

  it('still unlinks locally when the revoke fails, logging classification only', async (): Promise<void> => {
    const repo = new MemoryRepo(OWNER);
    await paired(repo);
    const warn = vi.fn();
    await new UnlinkStoreFromKiviUseCase(repo, tx, {
      gateway: gateway({
        revokeSelf: async (): Promise<void> => {
          throw new KiviPairingException('unavailable');
        },
      }),
      cipher,
      logger: { warn },
    }).execute({ userId: OWNER, tenantId: TENANT });
    expect(repo.saved?.getStatus()).toBe('unlinked');
    expect(repo.saved?.getEncryptedToken()).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).toContain('unavailable');
    expect(logged).not.toContain(TOKEN);
    expect(logged).not.toContain('api.kivi.example');
  });

  it('still unlinks when the ciphertext cannot be decrypted', async (): Promise<void> => {
    const repo = new MemoryRepo(OWNER);
    await paired(repo);
    const revokeSelf = vi.fn();
    await new UnlinkStoreFromKiviUseCase(repo, tx, {
      gateway: gateway({ revokeSelf }),
      cipher: {
        ...cipher,
        decrypt: (): string => {
          throw new KiviPortProbeException('boom');
        },
      },
      logger: { warn: vi.fn() },
    }).execute({ userId: OWNER, tenantId: TENANT });
    expect(revokeSelf).not.toHaveBeenCalled();
    expect(repo.saved?.getStatus()).toBe('unlinked');
  });

  it('keeps denying non-owners and unknown links', async (): Promise<void> => {
    const deps = { gateway: gateway(), cipher, logger: { warn: vi.fn() } };
    await expect(
      new UnlinkStoreFromKiviUseCase(new MemoryRepo('x'), tx, deps).execute({
        userId: OWNER,
        tenantId: TENANT,
      }),
    ).rejects.toBeInstanceOf(KiviLinkForbiddenException);
    await expect(
      new UnlinkStoreFromKiviUseCase(new MemoryRepo(OWNER), tx, deps).execute({
        userId: OWNER,
        tenantId: TENANT,
      }),
    ).rejects.toBeInstanceOf(KiviConnectionNotFoundException);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { RegisterKiviToolsUseCase } from '@/kivi/application/use-cases/register-kivi-tools.use-case';
import type {
  KiviToolsGatewayPort,
  KiviToolsRegistration,
  KiviToolsRegistrationResult,
} from '@/kivi/application/ports/out/kivi-tools-gateway.port';
import type { KiviTarget } from '@/kivi/application/ports/out/kivi-catalog-gateway.port';
import type { KiviConnectionRepositoryPort } from '@/kivi/application/ports/out/kivi-connection-repository.port';
import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';
import type { KiviConnection } from '@/kivi/domain/entities/kivi-connection.entity';
import { KiviGatewayException } from '@/kivi/application/exceptions/kivi-gateway.exception';
import { KIVI_TOOL_CATALOG } from '@/kivi/application/kivi-tool-catalog';
import { connection, TENANT, TOKEN } from '@/kivi/application/kivi-test-doubles';

class KeyProbeException extends Error {}

const USER = '33333333-3333-4333-8333-333333333333';
const KEY = 'e'.repeat(64);

const tx: TransactionManagerPort = {
  runInTransaction: async <T>(op: (c: TransactionContext) => Promise<T>): Promise<T> =>
    op({ executeNative: async (): Promise<never> => Promise.reject(new Error('unused')) }),
};

function repo(found: KiviConnection | null): KiviConnectionRepositoryPort {
  return {
    isStoreOwner: async (): Promise<boolean> => true,
    findStoreName: async (): Promise<string | null> => 'Tienda',
    findByTenant: async (): Promise<KiviConnection | null> => found,
    save: async (): Promise<void> => {},
  };
}

function build(options: {
  found?: KiviConnection | null;
  token?: string | null;
  result?: KiviToolsRegistrationResult | Error;
}): {
  useCase: RegisterKiviToolsUseCase;
  calls: Array<{ target: KiviTarget; registration: KiviToolsRegistration }>;
  warn: ReturnType<typeof vi.fn>;
} {
  const calls: Array<{ target: KiviTarget; registration: KiviToolsRegistration }> = [];
  const warn = vi.fn();
  const gateway: KiviToolsGatewayPort = {
    registerTools: async (target, registration): Promise<KiviToolsRegistrationResult> => {
      calls.push({ target, registration });
      const result = options.result ?? { available: true, registered: [], removed: [] };
      if (result instanceof Error) throw result;
      return result;
    },
  };
  const useCase = new RegisterKiviToolsUseCase(
    repo(options.found === undefined ? connection() : options.found),
    tx,
    { resolve: (): string | null => (options.token === undefined ? TOKEN : options.token) },
    gateway,
    (): string => KEY,
    KIVI_TOOL_CATALOG,
    { warn },
  );
  return { useCase, calls, warn };
}

const dto = {
  userId: USER,
  tenantId: TENANT,
  publicOrigin: 'https://shop.example.com' as string | null,
};

describe('RegisterKiviToolsUseCase', (): void => {
  it('registers base_url, derived key and the catalog with the resolved token', async (): Promise<void> => {
    const { useCase, calls } = build({});
    await expect(useCase.execute(dto)).resolves.toBe('registered');
    expect(calls).toHaveLength(1);
    expect(calls[0].registration).toEqual({
      baseUrl: 'https://shop.example.com/api/kivi/tools',
      key: KEY,
      tools: KIVI_TOOL_CATALOG,
    });
    expect(calls[0].target.token).toBe(TOKEN);
  });

  it('skips non-public origins without calling Kivi', async (): Promise<void> => {
    for (const publicOrigin of [
      null,
      'http://shop.example.com',
      'https://localhost:3000',
      'https://10.0.0.5',
      'https://shop.example.com/path',
      'https://user:pw@shop.example.com',
    ]) {
      const { useCase, calls } = build({});
      await expect(useCase.execute({ ...dto, publicOrigin })).resolves.toBe(
        'skipped_no_public_origin',
      );
      expect(calls).toHaveLength(0);
    }
  });

  it('reports no_connection when the store has none, is unlinked or has no readable token', async (): Promise<void> => {
    const unlinked = connection();
    unlinked.unlink();
    for (const options of [{ found: null }, { found: unlinked }, { token: null }]) {
      const { useCase, calls } = build(options);
      await expect(useCase.execute(dto)).resolves.toBe('no_connection');
      expect(calls).toHaveLength(0);
    }
  });

  it('reports not_available when Kivi lacks the scope (403/404)', async (): Promise<void> => {
    const { useCase } = build({ result: { available: false, registered: [], removed: [] } });
    await expect(useCase.execute(dto)).resolves.toBe('not_available');
  });

  it('never throws: gateway failures become "failed" and the log has no secrets', async (): Promise<void> => {
    const { useCase, warn } = build({ result: new KiviGatewayException('transient', 500) });
    await expect(useCase.execute(dto)).resolves.toBe('failed');
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).toContain('KiviGatewayException');
    expect(logged).not.toContain(TOKEN);
    expect(logged).not.toContain(KEY);
  });

  it('turns a key-derivation failure into "failed"', async (): Promise<void> => {
    const useCase = new RegisterKiviToolsUseCase(
      repo(connection()),
      tx,
      { resolve: (): string => TOKEN },
      { registerTools: async (): Promise<never> => Promise.reject(new Error('unused')) },
      (): never => {
        throw new KeyProbeException('no master key');
      },
      KIVI_TOOL_CATALOG,
      { warn: vi.fn() },
    );
    await expect(useCase.execute(dto)).resolves.toBe('failed');
  });
});

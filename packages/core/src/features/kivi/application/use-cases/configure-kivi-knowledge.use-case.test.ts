import { describe, expect, it, vi } from 'vitest';
import {
  ConfigureKiviKnowledgeUseCase,
  KIVI_KNOWLEDGE_KIND,
  KIVI_KNOWLEDGE_MAX_DOCUMENTS,
  kiviKnowledgeDisplayName,
  kiviKnowledgeDocumentId,
} from '@/kivi/application/use-cases/configure-kivi-knowledge.use-case';
import { connection, TENANT, TOKEN } from '@/kivi/application/kivi-test-doubles';
import type {
  KiviKnowledgeGatewayPort,
  KiviKnowledgeResource,
} from '@/kivi/application/ports/out/kivi-knowledge-gateway.port';
import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';

function resource(
  externalId: string,
  version: number,
  status: KiviKnowledgeResource['status'] = 'indexed',
): KiviKnowledgeResource {
  return {
    kind: KIVI_KNOWLEDGE_KIND,
    externalId,
    version,
    status,
    updatedAt: '2026-11-03T10:00:00Z',
    indexedAt: null,
  };
}

function setup(
  existing: KiviKnowledgeResource[] = [],
  owner: boolean = true,
): { useCase: ConfigureKiviKnowledgeUseCase; gateway: KiviKnowledgeGatewayPort } {
  const gateway: KiviKnowledgeGatewayPort = {
    list: vi.fn().mockResolvedValue(existing),
    put: vi
      .fn()
      .mockImplementation(
        async (
          _t: unknown,
          _k: string,
          id: string,
          version: number,
        ): Promise<KiviKnowledgeResource> => resource(id, version, 'pending'),
      ),
    remove: vi.fn().mockResolvedValue(resource('x', 1, 'deleted')),
    retry: vi.fn().mockResolvedValue(resource('x', 1, 'pending')),
  };
  const transactions: TransactionManagerPort = {
    runInTransaction: async <T>(op: (tx: TransactionContext) => Promise<T>): Promise<T> =>
      op({ executeNative: vi.fn() }),
  };
  return {
    gateway,
    useCase: new ConfigureKiviKnowledgeUseCase(
      {
        isStoreOwner: async (): Promise<boolean> => owner,
        findByTenant: async (): Promise<ReturnType<typeof connection> | null> => connection(),
        findStoreName: async (): Promise<string> => 'Store',
        save: vi.fn(),
      },
      transactions,
      { resolve: (): string => TOKEN },
      gateway,
      (title: string): string => `new-${title.length}`,
    ),
  };
}

const base = {
  userId: 'owner',
  tenantId: TENANT,
  documentId: '',
  title: 'Factura',
  content: 'Texto',
};

describe('ConfigureKiviKnowledgeUseCase', (): void => {
  it('rejects non-owners before reaching Kivi', async (): Promise<void> => {
    const { useCase, gateway } = setup([], false);
    await expect(useCase.execute({ ...base, operation: 'upload' })).rejects.toMatchObject({
      name: 'KiviLinkForbiddenException',
    });
    expect(gateway.list).not.toHaveBeenCalled();
  });

  it('creates a new document at version 1', async (): Promise<void> => {
    const { useCase, gateway } = setup();
    await useCase.execute({ ...base, operation: 'upload' });
    expect(gateway.put).toHaveBeenCalledWith(expect.anything(), KIVI_KNOWLEDGE_KIND, 'new-7', 1, {
      title: 'Factura',
      content: 'Texto',
    });
  });

  it('replaces an existing document with the next version', async (): Promise<void> => {
    const { useCase, gateway } = setup([resource('factura.ab12cd34', 4)]);
    await useCase.execute({ ...base, operation: 'upload', documentId: 'factura.ab12cd34' });
    expect(gateway.put).toHaveBeenCalledWith(
      expect.anything(),
      KIVI_KNOWLEDGE_KIND,
      'factura.ab12cd34',
      5,
      expect.anything(),
    );
  });

  it('deletes at the next version and refuses unknown documents', async (): Promise<void> => {
    const { useCase, gateway } = setup([resource('a.11111111', 2)]);
    await useCase.execute({ ...base, operation: 'delete', documentId: 'a.11111111' });
    expect(gateway.remove).toHaveBeenCalledWith(
      expect.anything(),
      KIVI_KNOWLEDGE_KIND,
      'a.11111111',
      3,
    );
    await expect(
      useCase.execute({ ...base, operation: 'delete', documentId: 'other.22222222' }),
    ).rejects.toMatchObject({ name: 'KiviGatewayException' });
  });

  it('retries only documents that exist', async (): Promise<void> => {
    const { useCase, gateway } = setup([resource('a.11111111', 1, 'failed')]);
    await useCase.execute({ ...base, operation: 'retry', documentId: 'a.11111111' });
    expect(gateway.retry).toHaveBeenCalledWith(
      expect.anything(),
      KIVI_KNOWLEDGE_KIND,
      'a.11111111',
    );
    await expect(
      useCase.execute({ ...base, operation: 'retry', documentId: 'nope.33333333' }),
    ).rejects.toMatchObject({ name: 'KiviGatewayException' });
  });

  it('caps the number of live documents but still allows replacing', async (): Promise<void> => {
    const full = Array.from(
      { length: KIVI_KNOWLEDGE_MAX_DOCUMENTS },
      (_, i): KiviKnowledgeResource => resource(`d${i}.00000000`, 1),
    );
    const { useCase, gateway } = setup(full);
    await expect(useCase.execute({ ...base, operation: 'upload' })).rejects.toMatchObject({
      name: 'KiviKnowledgeLimitException',
    });
    await useCase.execute({ ...base, operation: 'upload', documentId: 'd0.00000000' });
    expect(gateway.put).toHaveBeenCalledTimes(1);
  });
});

describe('knowledge document ids', (): void => {
  it('builds a Kivi-safe id from the title', (): void => {
    const id = kiviKnowledgeDocumentId('¿Cómo pido factura? RIMPE 2026');
    expect(id).toMatch(/^como-pido-factura-rimpe-2026\.[0-9a-f]{8}$/);
    expect(kiviKnowledgeDisplayName(id)).toBe('como pido factura rimpe 2026');
  });

  it('falls back when the title has no usable characters and bounds the length', (): void => {
    expect(kiviKnowledgeDocumentId('???')).toMatch(/^documento\.[0-9a-f]{8}$/);
    expect(kiviKnowledgeDocumentId('a'.repeat(500)).length).toBeLessThanOrEqual(89);
  });
});

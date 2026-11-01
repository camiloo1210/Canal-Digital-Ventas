import { describe, expect, it, vi } from 'vitest';
import { ConfigureKiviWhatsAppUseCase } from '@/kivi/application/use-cases/configure-kivi-whatsapp.use-case';
import { connection, TENANT, TOKEN } from '@/kivi/application/kivi-test-doubles';
import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';

describe('WhatsApp configuration authorization', (): void => {
  function setup(
    owner: boolean = true,
    linked: boolean = true,
  ): { useCase: ConfigureKiviWhatsAppUseCase; connect: ReturnType<typeof vi.fn> } {
    const connect = vi
      .fn()
      .mockResolvedValue({ connected: true, phoneDisplay: '+593', verifiedName: 'Store' });
    const transactions: TransactionManagerPort = {
      runInTransaction: async <T>(op: (tx: TransactionContext) => Promise<T>): Promise<T> =>
        op({ executeNative: vi.fn() }),
    };
    return {
      connect,
      useCase: new ConfigureKiviWhatsAppUseCase(
        {
          isStoreOwner: async (): Promise<boolean> => owner,
          findByTenant: async (): Promise<ReturnType<typeof connection> | null> =>
            linked ? connection() : null,
          findStoreName: async (): Promise<string> => 'Store',
          save: vi.fn(),
        },
        transactions,
        { resolve: (): string => TOKEN },
        { connect, validate: vi.fn(), disconnect: vi.fn() },
      ),
    };
  }
  it('rejects non-owners before reaching Kivi', async (): Promise<void> => {
    const { useCase, connect } = setup(false);
    await expect(
      useCase.execute({
        userId: 'attacker',
        tenantId: TENANT,
        operation: 'connect',
        phoneNumberId: '123',
        token: 'secret',
      }),
    ).rejects.toMatchObject({ name: 'KiviLinkForbiddenException' });
    expect(connect).not.toHaveBeenCalled();
  });
  it('rejects missing connections', async (): Promise<void> => {
    const { useCase, connect } = setup(true, false);
    await expect(
      useCase.execute({
        userId: 'owner',
        tenantId: TENANT,
        operation: 'connect',
        phoneNumberId: '123',
        token: 'secret',
      }),
    ).rejects.toMatchObject({ name: 'KiviConnectionNotFoundException' });
    expect(connect).not.toHaveBeenCalled();
  });
  it('uses the server-resolved credential and returns only safe channel metadata', async (): Promise<void> => {
    const { useCase, connect } = setup();
    const result = await useCase.execute({
      userId: 'owner',
      tenantId: TENANT,
      operation: 'connect',
      phoneNumberId: '123',
      token: 'meta-secret',
    });
    expect(connect).toHaveBeenCalledWith(expect.objectContaining({ token: TOKEN }), {
      phoneNumberId: '123',
      token: 'meta-secret',
    });
    expect(result).toEqual({ connected: true, phoneDisplay: '+593', verifiedName: 'Store' });
    expect(JSON.stringify(result)).not.toContain('secret');
  });
});

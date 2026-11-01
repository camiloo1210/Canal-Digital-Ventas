import { describe, expect, it, vi } from 'vitest';
import { KiviMessagingReadRepository } from '@/kivi/infrastructure/kivi-messaging-read.repository';
import { connection, TENANT, TOKEN } from '@/kivi/application/kivi-test-doubles';
import type { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';

describe('owner messaging diagnostics', (): void => {
  function setup(owner: boolean = true): {
    repository: KiviMessagingReadRepository;
    readDeliveries: ReturnType<typeof vi.fn>;
  } {
    const readDeliveries = vi.fn().mockRejectedValue(new Error('remote unavailable'));
    return {
      readDeliveries,
      repository: new KiviMessagingReadRepository(
        {
          isStoreOwner: async (): Promise<boolean> => owner,
          findByTenant: async (): Promise<ReturnType<typeof connection>> => connection(),
          findStoreName: async (): Promise<string> => 'Store',
          save: vi.fn(),
        },
        {
          runInTransaction: async <T>(op: (tx: TransactionContext) => Promise<T>): Promise<T> =>
            op({ executeNative: vi.fn() }),
        },
        { resolve: (): string => TOKEN },
        {
          readChannel: async (): Promise<boolean> => true,
          readSettings: async (): Promise<{
            whatsappEnabled: boolean;
            widgetEnabled: boolean;
            templateName: string;
            language: string;
          }> => ({
            whatsappEnabled: true,
            widgetEnabled: false,
            templateName: 'order_update',
            language: 'es',
          }),
          saveSettings: vi.fn(),
          readDeliveries,
        },
      ),
    };
  }

  it('keeps settings usable when delivery diagnostics are unavailable', async (): Promise<void> => {
    const { repository } = setup();
    const result = await repository.findForOwner('owner', TENANT);
    expect(result.channel).toBe('connected');
    expect(result.settings?.whatsappEnabled).toBe(true);
    expect(result.deliveries).toBeNull();
  });

  it('distinguishes no delivery attempts from unavailable diagnostics', async (): Promise<void> => {
    const { repository, readDeliveries } = setup();
    readDeliveries.mockResolvedValue([]);
    expect((await repository.findForOwner('owner', TENANT)).deliveries).toEqual([]);
  });

  it('denies non-owners before requesting remote diagnostics', async (): Promise<void> => {
    const { repository, readDeliveries } = setup(false);
    await expect(repository.findForOwner('member', TENANT)).rejects.toMatchObject({
      name: 'KiviLinkForbiddenException',
    });
    expect(readDeliveries).not.toHaveBeenCalled();
  });
});

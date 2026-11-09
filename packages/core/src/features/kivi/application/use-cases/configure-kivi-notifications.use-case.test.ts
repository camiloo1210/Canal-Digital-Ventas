import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigureKiviNotificationsUseCase } from '@/kivi/application/use-cases/configure-kivi-notifications.use-case';
import { KiviLinkForbiddenException } from '@/kivi/application/exceptions/kivi-link-forbidden.exception';
import { KiviConnectionNotFoundException } from '@/kivi/application/exceptions/kivi-connection-not-found.exception';
import { KiviGatewayException } from '@/kivi/application/exceptions/kivi-gateway.exception';
import { connection, TENANT, TOKEN } from '@/kivi/application/kivi-test-doubles';
import type { KiviConnectionRepositoryPort } from '@/kivi/application/ports/out/kivi-connection-repository.port';
import type {
  KiviNotificationSettings,
  KiviNotificationSettingsGatewayPort,
} from '@/kivi/application/ports/out/kivi-messaging.port';
import type { KiviSecretResolverPort } from '@/kivi/application/ports/out/kivi-secret-resolver.port';
import type { KiviConnection } from '@/kivi/domain/entities/kivi-connection.entity';
import { FakeTransactionManager } from '@/testing/fakes/fake-transaction-manager';

const OWNER = '99999999-9999-4999-8999-999999999999';
const STRANGER = '88888888-8888-4888-8888-888888888888';
const OTHER_TENANT = '77777777-7777-4777-8777-777777777777';

const SETTINGS: KiviNotificationSettings = {
  whatsappEnabled: true,
  widgetEnabled: false,
  templateName: 'order_update',
  language: 'es',
};

function repository(
  connectionByTenant: Map<string, KiviConnection>,
  owners: Set<string>,
): KiviConnectionRepositoryPort {
  return {
    isStoreOwner: async (userId, tenantId): Promise<boolean> => owners.has(`${userId}:${tenantId}`),
    findStoreName: async (): Promise<string | null> => 'Store',
    findByTenant: async (tenantId): Promise<KiviConnection | null> =>
      connectionByTenant.get(tenantId) ?? null,
    save: vi.fn(),
  };
}

describe('ConfigureKiviNotificationsUseCase', (): void => {
  let transactions: FakeTransactionManager;
  let saveSettings: ReturnType<typeof vi.fn<KiviNotificationSettingsGatewayPort['saveSettings']>>;
  let gateway: KiviNotificationSettingsGatewayPort;
  let resolver: KiviSecretResolverPort;
  let connections: Map<string, KiviConnection>;
  let owners: Set<string>;

  function build(): ConfigureKiviNotificationsUseCase {
    return new ConfigureKiviNotificationsUseCase(
      repository(connections, owners),
      transactions,
      resolver,
      gateway,
    );
  }

  beforeEach((): void => {
    transactions = new FakeTransactionManager();
    saveSettings = vi.fn<KiviNotificationSettingsGatewayPort['saveSettings']>();
    gateway = {
      saveSettings,
      readSettings: vi.fn(),
      readChannel: vi.fn(),
      readDeliveries: vi.fn(),
    };
    resolver = { resolve: (): string | null => TOKEN };
    connections = new Map([[TENANT, connection()]]);
    owners = new Set([`${OWNER}:${TENANT}`]);
  });

  it('saves the settings for the store owner against the resolved target', async (): Promise<void> => {
    await build().execute({ ...SETTINGS, userId: OWNER, tenantId: TENANT });
    expect(saveSettings).toHaveBeenCalledTimes(1);
    expect(saveSettings).toHaveBeenCalledWith(
      {
        baseUrl: 'https://api.kivi.example',
        connectionId: '22222222-2222-4222-8222-222222222222',
        token: TOKEN,
      },
      SETTINGS,
    );
    expect(transactions.committed).toBe(1);
    expect(transactions.calls).toEqual([{ userId: OWNER, tenantId: TENANT }]);
  });

  it('forwards only the four settings fields, never userId or tenantId', async (): Promise<void> => {
    await build().execute({ ...SETTINGS, userId: OWNER, tenantId: TENANT });
    expect(Object.keys(saveSettings.mock.calls[0]?.[1] ?? {}).sort()).toEqual([
      'language',
      'templateName',
      'whatsappEnabled',
      'widgetEnabled',
    ]);
  });

  it('rejects a user who is not the store owner and saves nothing', async (): Promise<void> => {
    await expect((): Promise<void> =>
      build().execute({ ...SETTINGS, userId: STRANGER, tenantId: TENANT }),
    ).rejects.toThrow(KiviLinkForbiddenException);
    expect(saveSettings).not.toHaveBeenCalled();
    expect(transactions.rolledBack).toBe(1);
  });

  it('rejects the owner of another tenant acting on this tenant and saves nothing', async (): Promise<void> => {
    owners.add(`${STRANGER}:${OTHER_TENANT}`);
    connections.set(OTHER_TENANT, connection());
    await expect((): Promise<void> =>
      build().execute({ ...SETTINGS, userId: STRANGER, tenantId: TENANT }),
    ).rejects.toThrow(KiviLinkForbiddenException);
    expect(saveSettings).not.toHaveBeenCalled();
  });

  it('fails with not found when the store has no Kivi connection and saves nothing', async (): Promise<void> => {
    connections.clear();
    await expect((): Promise<void> =>
      build().execute({ ...SETTINGS, userId: OWNER, tenantId: TENANT }),
    ).rejects.toThrow(KiviConnectionNotFoundException);
    expect(saveSettings).not.toHaveBeenCalled();
  });

  it('fails with a gateway rejection when no token can be resolved and saves nothing', async (): Promise<void> => {
    resolver = { resolve: (): string | null => null };
    await expect((): Promise<void> =>
      build().execute({ ...SETTINGS, userId: OWNER, tenantId: TENANT }),
    ).rejects.toThrow(KiviGatewayException);
    expect(saveSettings).not.toHaveBeenCalled();
  });

  it('propagates a gateway failure on save', async (): Promise<void> => {
    saveSettings.mockRejectedValue(new KiviGatewayException('rejected', 401));
    await expect((): Promise<void> =>
      build().execute({ ...SETTINGS, userId: OWNER, tenantId: TENANT }),
    ).rejects.toThrow(KiviGatewayException);
  });
});

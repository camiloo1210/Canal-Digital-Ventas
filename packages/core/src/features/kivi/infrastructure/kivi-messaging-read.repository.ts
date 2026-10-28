import type { KiviConnectionRepositoryPort } from '@/kivi/application/ports/out/kivi-connection-repository.port';
import type { TransactionManagerPort } from '@/shared/application/ports/out/transaction-manager.port';
import type { KiviSecretResolverPort } from '@/kivi/application/ports/out/kivi-secret-resolver.port';
import type {
  KiviMessagingReadPort,
  KiviMessagingStatus,
  KiviNotificationSettingsGatewayPort,
} from '@/kivi/application/ports/out/kivi-messaging.port';
import { resolveKiviOwnerTarget } from '@/kivi/application/kivi-owner-target';

export class KiviMessagingReadRepository implements KiviMessagingReadPort {
  public constructor(
    private readonly repository: KiviConnectionRepositoryPort,
    private readonly transactions: TransactionManagerPort,
    private readonly secrets: KiviSecretResolverPort,
    private readonly gateway: KiviNotificationSettingsGatewayPort,
  ) {}
  public async findForOwner(userId: string, tenantId: string): Promise<KiviMessagingStatus> {
    const target = await resolveKiviOwnerTarget(
      this.repository,
      this.transactions,
      this.secrets,
      userId,
      tenantId,
    );
    const [channel, settings] = await Promise.allSettled([
      this.gateway.readChannel(target),
      this.gateway.readSettings(target),
    ]);
    return {
      channel:
        channel.status === 'fulfilled'
          ? channel.value
            ? 'connected'
            : 'disconnected'
          : 'unavailable',
      settings: settings.status === 'fulfilled' ? settings.value : null,
    };
  }
}

import type { KiviConnectionRepositoryPort } from '@/kivi/application/ports/out/kivi-connection-repository.port';
import type { TransactionManagerPort } from '@/shared/application/ports/out/transaction-manager.port';
import type { KiviSecretResolverPort } from '@/kivi/application/ports/out/kivi-secret-resolver.port';
import type {
  KiviNotificationSettings,
  KiviNotificationSettingsGatewayPort,
} from '@/kivi/application/ports/out/kivi-messaging.port';
import { resolveKiviOwnerTarget } from '@/kivi/application/kivi-owner-target';

export class ConfigureKiviNotificationsUseCase {
  public constructor(
    private readonly repository: KiviConnectionRepositoryPort,
    private readonly transactions: TransactionManagerPort,
    private readonly secrets: KiviSecretResolverPort,
    private readonly gateway: KiviNotificationSettingsGatewayPort,
  ) {}
  public async execute(
    dto: KiviNotificationSettings & { userId: string; tenantId: string },
  ): Promise<void> {
    const target = await resolveKiviOwnerTarget(
      this.repository,
      this.transactions,
      this.secrets,
      dto.userId,
      dto.tenantId,
    );
    await this.gateway.saveSettings(target, {
      whatsappEnabled: dto.whatsappEnabled,
      widgetEnabled: dto.widgetEnabled,
      templateName: dto.templateName,
      language: dto.language,
    });
  }
}

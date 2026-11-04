import type { KiviConnectionRepositoryPort } from '@/kivi/application/ports/out/kivi-connection-repository.port';
import type { TransactionManagerPort } from '@/shared/application/ports/out/transaction-manager.port';
import type { KiviSecretResolverPort } from '@/kivi/application/ports/out/kivi-secret-resolver.port';
import type {
  KiviWhatsAppGatewayPort,
  KiviWhatsAppResult,
} from '@/kivi/application/ports/out/kivi-whatsapp-gateway.port';
import type { KiviTarget } from '@/kivi/application/ports/out/kivi-catalog-gateway.port';
import { resolveKiviOwnerTarget } from '@/kivi/application/kivi-owner-target';

export interface ConfigureKiviWhatsAppDto {
  userId: string;
  tenantId: string;
  operation: 'validate' | 'connect' | 'disconnect';
  phoneNumberId: string;
  token: string;
}
export class ConfigureKiviWhatsAppUseCase {
  public constructor(
    private readonly repository: KiviConnectionRepositoryPort,
    private readonly transactions: TransactionManagerPort,
    private readonly secrets: KiviSecretResolverPort,
    private readonly gateway: KiviWhatsAppGatewayPort,
  ) {}
  public async execute(dto: ConfigureKiviWhatsAppDto): Promise<KiviWhatsAppResult> {
    const target = await resolveKiviOwnerTarget(
      this.repository,
      this.transactions,
      this.secrets,
      dto.userId,
      dto.tenantId,
    );
    // Kivi owns credential validation and persistence. Never hold a SQL transaction over HTTP.
    if (dto.operation === 'disconnect') {
      const result = await this.gateway.disconnect(target);
      return { ...result, widgetHandoff: await this.syncHandoff(target, false) };
    }
    const credentials = { phoneNumberId: dto.phoneNumberId, token: dto.token };
    if (dto.operation === 'validate') return this.gateway.validate(target, credentials);
    const result = await this.gateway.connect(target, credentials);
    return { ...result, widgetHandoff: await this.syncHandoff(target, true) };
  }
  /** Best effort: WhatsApp is already (dis)connected, so a widget failure must not fail the request. */
  private async syncHandoff(
    target: KiviTarget,
    enabled: boolean,
  ): Promise<'enabled' | 'disabled' | 'skipped'> {
    try {
      return (await this.gateway.syncWidgetHandoff(target, enabled))
        ? enabled
          ? 'enabled'
          : 'disabled'
        : 'skipped';
    } catch {
      return 'skipped';
    }
  }
}

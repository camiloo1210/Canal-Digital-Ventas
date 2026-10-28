import type { KiviTarget } from '@/kivi/application/ports/out/kivi-catalog-gateway.port';
import type {
  KiviWhatsAppCredentials,
  KiviWhatsAppGatewayPort,
  KiviWhatsAppResult,
} from '@/kivi/application/ports/out/kivi-whatsapp-gateway.port';
import { HttpKiviCatalogGateway } from '@/kivi/infrastructure/http-kivi-catalog.gateway';
import { KiviGatewayException } from '@/kivi/application/exceptions/kivi-gateway.exception';

export class HttpKiviWhatsAppGateway
  extends HttpKiviCatalogGateway
  implements KiviWhatsAppGatewayPort
{
  public async validate(
    target: KiviTarget,
    credentials: KiviWhatsAppCredentials,
  ): Promise<KiviWhatsAppResult> {
    return this.parse(
      await this.request(target, 'POST', '/channels/whatsapp/validate', this.payload(credentials)),
      false,
    );
  }
  public async connect(
    target: KiviTarget,
    credentials: KiviWhatsAppCredentials,
  ): Promise<KiviWhatsAppResult> {
    return this.parse(
      await this.request(target, 'PUT', '/channels/whatsapp', this.payload(credentials)),
      true,
    );
  }
  public async disconnect(target: KiviTarget): Promise<KiviWhatsAppResult> {
    await this.request(target, 'DELETE', '/channels/whatsapp');
    return { connected: false, phoneDisplay: '', verifiedName: '' };
  }
  private payload(credentials: KiviWhatsAppCredentials): {
    phone_number_id: string;
    whatsapp_token: string;
  } {
    return { phone_number_id: credentials.phoneNumberId, whatsapp_token: credentials.token };
  }
  private parse(body: unknown, connected: boolean): KiviWhatsAppResult {
    if (
      typeof body !== 'object' ||
      body === null ||
      (connected
        ? !('status' in body) || body.status !== 'connected'
        : !('valid' in body) || body.valid !== true)
    )
      throw new KiviGatewayException('rejected', 400);
    return {
      connected,
      phoneDisplay:
        'phone_display' in body && typeof body.phone_display === 'string'
          ? body.phone_display.slice(0, 100)
          : '',
      verifiedName:
        'verified_name' in body && typeof body.verified_name === 'string'
          ? body.verified_name.slice(0, 200)
          : '',
    };
  }
}

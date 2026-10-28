import { HttpKiviCatalogGateway } from '@/kivi/infrastructure/http-kivi-catalog.gateway';
import type { KiviTarget } from '@/kivi/application/ports/out/kivi-catalog-gateway.port';
import type {
  KiviNotificationSettings,
  KiviNotificationSettingsGatewayPort,
} from '@/kivi/application/ports/out/kivi-messaging.port';
import { KiviGatewayException } from '@/kivi/application/exceptions/kivi-gateway.exception';
import type { KiviStoreWidget } from '@/kivi/application/ports/out/kivi-store-widget-read.port';

export class HttpKiviNotificationSettingsGateway
  extends HttpKiviCatalogGateway
  implements KiviNotificationSettingsGatewayPort
{
  public async readWidget(target: KiviTarget): Promise<KiviStoreWidget | null> {
    const body = await this.request(target, 'GET', '/widget');
    if (
      typeof body === 'object' &&
      body !== null &&
      'widget_key' in body &&
      body.widget_key === null
    )
      return null;
    if (
      typeof body !== 'object' ||
      body === null ||
      !('widget_key' in body) ||
      typeof body.widget_key !== 'string' ||
      !/^pk_live_[A-Za-z0-9_-]{32}$/.test(body.widget_key)
    )
      throw new KiviGatewayException('transient', 200);
    return { widgetKey: body.widget_key };
  }
  public async readChannel(target: KiviTarget): Promise<boolean> {
    const body = await this.request(target, 'GET', '/channels/whatsapp');
    if (
      typeof body !== 'object' ||
      body === null ||
      !('connected' in body) ||
      typeof body.connected !== 'boolean'
    )
      throw new KiviGatewayException('transient', 200);
    return body.connected;
  }
  public async readSettings(target: KiviTarget): Promise<KiviNotificationSettings> {
    const body = await this.request(target, 'GET', '/notifications/settings');
    if (
      typeof body !== 'object' ||
      body === null ||
      !('whatsapp_enabled' in body) ||
      typeof body.whatsapp_enabled !== 'boolean' ||
      !('widget_enabled' in body) ||
      typeof body.widget_enabled !== 'boolean' ||
      !('template_name' in body) ||
      typeof body.template_name !== 'string' ||
      !/^[a-z][a-z0-9_]{0,99}$/.test(body.template_name) ||
      !('language' in body) ||
      (body.language !== 'es' && body.language !== 'en')
    )
      throw new KiviGatewayException('transient', 200);
    return {
      whatsappEnabled: body.whatsapp_enabled,
      widgetEnabled: body.widget_enabled,
      templateName: body.template_name,
      language: body.language,
    };
  }
  public async saveSettings(target: KiviTarget, settings: KiviNotificationSettings): Promise<void> {
    await this.request(target, 'PUT', '/notifications/settings', {
      whatsapp_enabled: settings.whatsappEnabled,
      widget_enabled: settings.widgetEnabled,
      template_name: settings.templateName,
      language: settings.language,
    });
  }
}

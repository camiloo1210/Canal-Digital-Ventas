import { HttpKiviCatalogGateway } from '@/kivi/infrastructure/http-kivi-catalog.gateway';
import type { KiviTarget } from '@/kivi/application/ports/out/kivi-catalog-gateway.port';
import type {
  KiviChannelAccount,
  KiviNotificationSettings,
  KiviNotificationSettingsGatewayPort,
  KiviDeliverySummary,
} from '@/kivi/application/ports/out/kivi-messaging.port';
import { KiviGatewayException } from '@/kivi/application/exceptions/kivi-gateway.exception';
import type { KiviStoreWidget } from '@/kivi/application/ports/out/kivi-store-widget-read.port';

export class HttpKiviNotificationSettingsGateway
  extends HttpKiviCatalogGateway
  implements KiviNotificationSettingsGatewayPort
{
  public async readDeliveries(target: KiviTarget): Promise<KiviDeliverySummary[]> {
    const body = await this.request(target, 'GET', '/notifications/deliveries');
    if (!Array.isArray(body) || body.length > 10) throw new KiviGatewayException('transient', 200);
    return body.map((row: unknown): KiviDeliverySummary => {
      if (
        typeof row !== 'object' ||
        row === null ||
        !('event_id' in row) ||
        typeof row.event_id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.event_id) ||
        !('channel' in row) ||
        (row.channel !== 'whatsapp' && row.channel !== 'widget') ||
        !('status' in row) ||
        (row.status !== 'pending' &&
          row.status !== 'sending' &&
          row.status !== 'sent' &&
          row.status !== 'failed' &&
          row.status !== 'unknown' &&
          row.status !== 'skipped') ||
        !('updated_at' in row) ||
        typeof row.updated_at !== 'string' ||
        !Number.isFinite(Date.parse(row.updated_at))
      )
        throw new KiviGatewayException('transient', 200);
      return {
        eventId: row.event_id,
        channel: row.channel,
        status: row.status,
        updatedAt: row.updated_at,
      };
    });
  }
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
  public async readChannel(target: KiviTarget): Promise<KiviChannelAccount> {
    const body = await this.request(target, 'GET', '/channels/whatsapp');
    if (
      typeof body !== 'object' ||
      body === null ||
      !('connected' in body) ||
      typeof body.connected !== 'boolean'
    )
      throw new KiviGatewayException('transient', 200);
    // Allowlist: only identity fields leave this adapter, never credentials.
    const fields: Record<string, unknown> = { ...body };
    const text = (key: 'external_id' | 'name', max: number): string | null => {
      const value = fields[key];
      return typeof value === 'string' ? value.slice(0, max) || null : null;
    };
    return body.connected
      ? { connected: true, phoneNumberId: text('external_id', 64), name: text('name', 200) }
      : { connected: false, phoneNumberId: null, name: null };
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
      typeof body.language !== 'string' ||
      !/^(?:es|en)(?:_[A-Z]{2})?(?![\s\S])/.test(body.language)
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

import type { KiviTarget } from '@/kivi/application/ports/out/kivi-catalog-gateway.port';

export interface KiviNotificationSettings {
  whatsappEnabled: boolean;
  widgetEnabled: boolean;
  templateName: string;
  /** Exact Meta template locale; status text supports Spanish and English. */
  language: string;
}
/** Non-secret identity of the WhatsApp number Kivi holds. Never carries the token. */
export interface KiviChannelAccount {
  connected: boolean;
  phoneNumberId: string | null;
  name: string | null;
}
export interface KiviMessagingStatus {
  channel: 'connected' | 'disconnected' | 'unavailable';
  /** Present only while Kivi reports a connected number. */
  account: Omit<KiviChannelAccount, 'connected'> | null;
  settings: KiviNotificationSettings | null;
  /** null means diagnostics unavailable; [] means no attempts recorded. */
  deliveries: KiviDeliverySummary[] | null;
}
export interface KiviDeliverySummary {
  eventId: string;
  channel: 'whatsapp' | 'widget';
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'unknown' | 'skipped';
  updatedAt: string;
}
export interface KiviMessagingReadPort {
  findForOwner(userId: string, tenantId: string): Promise<KiviMessagingStatus>;
}
export interface KiviNotificationSettingsGatewayPort {
  readSettings(target: KiviTarget): Promise<KiviNotificationSettings>;
  saveSettings(target: KiviTarget, settings: KiviNotificationSettings): Promise<void>;
  readChannel(target: KiviTarget): Promise<KiviChannelAccount>;
  readDeliveries(target: KiviTarget): Promise<KiviDeliverySummary[]>;
}

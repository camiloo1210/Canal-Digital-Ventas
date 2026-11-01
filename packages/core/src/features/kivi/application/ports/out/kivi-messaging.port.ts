import type { KiviTarget } from '@/kivi/application/ports/out/kivi-catalog-gateway.port';

export interface KiviNotificationSettings {
  whatsappEnabled: boolean;
  widgetEnabled: boolean;
  templateName: string;
  /** Exact Meta template locale; status text supports Spanish and English. */
  language: string;
}
export interface KiviMessagingStatus {
  channel: 'connected' | 'disconnected' | 'unavailable';
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
  readChannel(target: KiviTarget): Promise<boolean>;
  readDeliveries(target: KiviTarget): Promise<KiviDeliverySummary[]>;
}

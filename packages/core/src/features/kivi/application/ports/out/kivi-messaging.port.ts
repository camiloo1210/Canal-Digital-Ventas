import type { KiviTarget } from '@/kivi/application/ports/out/kivi-catalog-gateway.port';

export interface KiviNotificationSettings {
  whatsappEnabled: boolean;
  widgetEnabled: boolean;
  templateName: string;
  language: 'es' | 'en';
}
export interface KiviMessagingStatus {
  channel: 'connected' | 'disconnected' | 'unavailable';
  settings: KiviNotificationSettings | null;
}
export interface KiviMessagingReadPort {
  findForOwner(userId: string, tenantId: string): Promise<KiviMessagingStatus>;
}
export interface KiviNotificationSettingsGatewayPort {
  readSettings(target: KiviTarget): Promise<KiviNotificationSettings>;
  saveSettings(target: KiviTarget, settings: KiviNotificationSettings): Promise<void>;
  readChannel(target: KiviTarget): Promise<boolean>;
}

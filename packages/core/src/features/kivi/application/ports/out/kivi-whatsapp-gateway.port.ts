import type { KiviTarget } from '@/kivi/application/ports/out/kivi-catalog-gateway.port';

export interface KiviWhatsAppCredentials {
  phoneNumberId: string;
  token: string;
}
export interface KiviWhatsAppResult {
  connected: boolean;
  phoneDisplay: string;
  verifiedName: string;
  /** Web widget "Continue on WhatsApp" button: applied, or skipped (no widget / Kivi error). */
  widgetHandoff?: 'enabled' | 'disabled' | 'skipped';
}
export interface KiviWhatsAppGatewayPort {
  validate(target: KiviTarget, credentials: KiviWhatsAppCredentials): Promise<KiviWhatsAppResult>;
  connect(target: KiviTarget, credentials: KiviWhatsAppCredentials): Promise<KiviWhatsAppResult>;
  disconnect(target: KiviTarget): Promise<KiviWhatsAppResult>;
  /** Kivi derives the number from the connected account; false when it has no widget yet. */
  syncWidgetHandoff(target: KiviTarget, enabled: boolean): Promise<boolean>;
}

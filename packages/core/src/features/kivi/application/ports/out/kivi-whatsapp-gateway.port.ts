import type { KiviTarget } from '@/kivi/application/ports/out/kivi-catalog-gateway.port';

export interface KiviWhatsAppCredentials {
  phoneNumberId: string;
  token: string;
}
export interface KiviWhatsAppResult {
  connected: boolean;
  phoneDisplay: string;
  verifiedName: string;
}
export interface KiviWhatsAppGatewayPort {
  validate(target: KiviTarget, credentials: KiviWhatsAppCredentials): Promise<KiviWhatsAppResult>;
  connect(target: KiviTarget, credentials: KiviWhatsAppCredentials): Promise<KiviWhatsAppResult>;
  disconnect(target: KiviTarget): Promise<KiviWhatsAppResult>;
}

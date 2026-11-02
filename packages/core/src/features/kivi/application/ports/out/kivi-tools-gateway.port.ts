import type { KiviTarget } from '@/kivi/application/ports/out/kivi-catalog-gateway.port';
import type { KiviToolDefinition } from '@/kivi/application/kivi-tool-catalog';

export interface KiviToolsRegistration {
  baseUrl: string;
  /** 64 lowercase hex. Secret: never log it. */
  key: string;
  tools: readonly KiviToolDefinition[];
}

export interface KiviToolsRegistrationResult {
  /** False when Kivi answered 403/404 (scope or feature missing): not an error. */
  available: boolean;
  registered: string[];
  removed: string[];
}

export interface KiviToolsGatewayPort {
  /** Full-replace, idempotent. Throws KiviGatewayException for failures other than 403/404. */
  registerTools(
    target: KiviTarget,
    registration: KiviToolsRegistration,
  ): Promise<KiviToolsRegistrationResult>;
}

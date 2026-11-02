import type { KiviTarget } from '@/kivi/application/ports/out/kivi-catalog-gateway.port';
import type {
  KiviToolsGatewayPort,
  KiviToolsRegistration,
  KiviToolsRegistrationResult,
} from '@/kivi/application/ports/out/kivi-tools-gateway.port';
import { KiviGatewayException } from '@/kivi/application/exceptions/kivi-gateway.exception';
import { HttpKiviCatalogGateway } from '@/kivi/infrastructure/http-kivi-catalog.gateway';

function names(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item: unknown): item is string => typeof item === 'string')
    : [];
}

/** Reuses the catalog gateway transport: timeout, no redirects, SSRF guard, no secrets in errors. */
export class HttpKiviToolsGateway extends HttpKiviCatalogGateway implements KiviToolsGatewayPort {
  public async registerTools(
    target: KiviTarget,
    registration: KiviToolsRegistration,
  ): Promise<KiviToolsRegistrationResult> {
    let body: unknown;
    try {
      body = await this.request(target, 'PUT', '/tools', {
        base_url: registration.baseUrl,
        key: registration.key,
        tools: registration.tools,
      });
    } catch (error: unknown) {
      if (error instanceof KiviGatewayException && (error.status === 403 || error.status === 404)) {
        return { available: false, registered: [], removed: [] };
      }
      throw error;
    }
    const record: Record<string, unknown> =
      typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
    return {
      available: true,
      registered: names(record.registered),
      removed: names(record.removed),
    };
  }
}

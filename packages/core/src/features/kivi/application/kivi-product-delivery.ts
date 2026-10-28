import type {
  KiviCatalogGatewayPort,
  KiviTarget,
} from '@/kivi/application/ports/out/kivi-catalog-gateway.port';
import type { KiviSecretResolverPort } from '@/kivi/application/ports/out/kivi-secret-resolver.port';
import type { KiviSourceProduct } from '@/kivi/application/ports/out/kivi-sync-store.port';
import type { KiviConnection } from '@/kivi/domain/entities/kivi-connection.entity';
import { KiviDeliveryException } from '@/kivi/application/exceptions/kivi-delivery.exception';
import { KiviGatewayException } from '@/kivi/application/exceptions/kivi-gateway.exception';
import { kiviVersionOf, toKiviProductPayload } from '@/kivi/application/kivi-product.mapper';

export type DeliveryOutcome = 'delivered' | 'conflict';

/** Shared delivery rules: state-based (archived => DELETE), versioned, 409 never auto-bumped. */
export class KiviProductDelivery {
  public constructor(
    private readonly gateway: KiviCatalogGatewayPort,
    private readonly secrets: KiviSecretResolverPort,
  ) {}

  public targetOf(connection: KiviConnection): KiviTarget {
    const token = this.secrets.resolve(connection);
    if (!token) throw new KiviDeliveryException('credential is not configured');
    return {
      baseUrl: connection.getBaseUrl().getValue(),
      connectionId: connection.getConnectionId(),
      token,
    };
  }

  /** Returns 'conflict' on 409 (never retried blindly); other failures throw a retryable KiviDeliveryException. */
  public async send(target: KiviTarget, product: KiviSourceProduct): Promise<DeliveryOutcome> {
    try {
      if (product.status === 'archived') {
        await this.gateway.deleteProduct(target, product.id, kiviVersionOf(product));
      } else {
        await this.gateway.putProduct(target, product.id, toKiviProductPayload(product));
      }
      return 'delivered';
    } catch (error: unknown) {
      if (error instanceof KiviGatewayException && error.failure === 'conflict') return 'conflict';
      throw KiviProductDelivery.toDeliveryFailure(error);
    }
  }

  /** Converts any gateway failure into a retryable, secret-free delivery failure. */
  public static toDeliveryFailure(error: unknown): KiviDeliveryException {
    if (error instanceof KiviGatewayException) {
      return new KiviDeliveryException(error.failure, error.retryAfterMs);
    }
    return new KiviDeliveryException('unexpected');
  }
}

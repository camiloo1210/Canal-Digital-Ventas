import type { PaymentCheckoutRepositoryPort } from '@/payments/application/ports/out/payment-checkout-repository.port';
import type {
  PaymentEnvironment,
  ProviderCheckout,
  ProviderCheckoutPort,
} from '@/payments/application/ports/out/provider-checkout.port';
import { ProviderCheckoutException } from '@/payments/application/exceptions/provider-checkout.exception';
import { PaymentCheckoutException } from '@/payments/application/exceptions/payment-checkout.exception';

export interface StartPaymentCheckoutDto {
  readonly orderId: string;
  readonly authenticatedBuyerId: string;
}

export interface StartPaymentCheckoutResult {
  readonly paymentId: string;
  readonly status: 'CHECKOUT_READY' | 'ALREADY_PAID';
  readonly checkoutUrl: string | null;
}

export class StartPaymentCheckoutUseCase {
  public constructor(
    private readonly repository: PaymentCheckoutRepositoryPort,
    private readonly gateway: ProviderCheckoutPort,
    private readonly environment: PaymentEnvironment,
  ) {}

  public async execute(dto: StartPaymentCheckoutDto): Promise<StartPaymentCheckoutResult> {
    const reservation = await this.repository.reserve({
      orderId: dto.orderId,
      authenticatedBuyerId: dto.authenticatedBuyerId,
      environment: this.environment,
      ttlSeconds: 1800,
    });

    if (reservation.outcome === 'ALREADY_PAID') {
      return { paymentId: reservation.paymentId, status: 'ALREADY_PAID', checkoutUrl: null };
    }
    if (reservation.outcome === 'BUSY' || reservation.outcome === 'CREATION_UNAVAILABLE') {
      throw new PaymentCheckoutException(reservation.outcome);
    }
    if (reservation.outcome === 'EXISTING_WITH_CHECKOUT') {
      if (!reservation.checkoutUrl) throw new PaymentCheckoutException('INVALID_RESERVATION');
      return {
        paymentId: reservation.paymentId,
        status: 'CHECKOUT_READY',
        checkoutUrl: reservation.checkoutUrl,
      };
    }
    const token = reservation.creationToken;
    if (
      !token ||
      reservation.orderId !== dto.orderId ||
      reservation.environment !== this.environment
    ) {
      throw new PaymentCheckoutException('INVALID_RESERVATION');
    }

    let checkout: ProviderCheckout;
    try {
      checkout = await this.gateway.create(reservation);
    } catch (error: unknown) {
      const failure = error instanceof ProviderCheckoutException ? error : null;
      const resolvedFailure = await this.repository.resolve({
        paymentId: reservation.paymentId,
        creationToken: token,
        mode: failure?.outcome ?? 'AMBIGUOUS',
        checkoutId: null,
        checkoutUrl: null,
        reasonCode: failure?.reasonCode ?? 'UNKNOWN_PROVIDER_OUTCOME',
      });
      if (resolvedFailure === 'ALREADY_PAID') {
        return { paymentId: reservation.paymentId, status: 'ALREADY_PAID', checkoutUrl: null };
      }
      throw new PaymentCheckoutException(
        failure?.outcome === 'REJECTED' ? 'CHECKOUT_REJECTED' : 'CREATION_UNAVAILABLE',
      );
    }

    // A failure here is not a failed HTTP call: leave the lease for recovery, never POST again.
    const resolved = await this.repository.resolve({
      paymentId: reservation.paymentId,
      creationToken: token,
      mode: 'CREATED',
      checkoutId: checkout.checkoutId,
      checkoutUrl: checkout.checkoutUrl,
      reasonCode: null,
    });
    return resolved === 'ALREADY_PAID'
      ? { paymentId: reservation.paymentId, status: 'ALREADY_PAID', checkoutUrl: null }
      : {
          paymentId: reservation.paymentId,
          status: 'CHECKOUT_READY',
          checkoutUrl: checkout.checkoutUrl,
        };
  }
}

import type {
  CreateProviderCheckout,
  PaymentEnvironment,
} from '@/payments/application/ports/out/provider-checkout.port';

export interface ReserveCheckout {
  readonly orderId: string;
  readonly authenticatedBuyerId: string;
  readonly environment: PaymentEnvironment;
  readonly ttlSeconds: number;
}

export interface CheckoutReservation extends CreateProviderCheckout {
  readonly outcome:
    | 'CREATED'
    | 'EXISTING_NO_CHECKOUT'
    | 'EXISTING_WITH_CHECKOUT'
    | 'BUSY'
    | 'CREATION_UNAVAILABLE'
    | 'ALREADY_PAID';
  readonly creationToken: string | null;
  readonly checkoutUrl: string | null;
}

export interface CheckoutResolution {
  readonly paymentId: string;
  readonly creationToken: string;
  readonly mode: 'CREATED' | 'AMBIGUOUS' | 'REJECTED';
  readonly checkoutId: string | null;
  readonly checkoutUrl: string | null;
  readonly reasonCode: string | null;
}

export interface PaymentCheckoutRepositoryPort {
  reserve(input: ReserveCheckout): Promise<CheckoutReservation>;
  resolve(input: CheckoutResolution): Promise<'PENDING' | 'ALREADY_PAID'>;
}

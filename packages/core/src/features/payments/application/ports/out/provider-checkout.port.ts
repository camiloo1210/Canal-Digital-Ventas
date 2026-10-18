export type PaymentEnvironment = 'test' | 'production';

/** The amount and identity are returned by the authorized persistence boundary. */
export interface CreateProviderCheckout {
  readonly paymentId: string;
  readonly orderId: string;
  readonly tenantId: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly storeId: string;
  readonly expiresAt: string;
  readonly environment: PaymentEnvironment;
}

export interface ProviderCheckout {
  readonly checkoutId: string;
  readonly checkoutUrl: string;
}

export interface ProviderCheckoutPort {
  create(input: CreateProviderCheckout): Promise<ProviderCheckout>;
}

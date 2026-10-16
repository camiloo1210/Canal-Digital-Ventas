export interface DispatchProviderRefund {
  providerOrderId: string;
  storeId: string;
  currency: string;
  environment: 'test' | 'production';
  amountCents: number;
}

/** Acceptance of an HTTP request is not evidence that a refund settled. */
export interface ProviderRefundPort {
  dispatch(input: DispatchProviderRefund): Promise<{ providerOrderId: string }>;
}

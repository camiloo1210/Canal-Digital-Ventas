import type {
  DispatchProviderRefund,
  ProviderRefundPort,
} from '@/payments/application/ports/out/provider-refund.port';
import { ProviderRefundException } from '@/payments/application/exceptions/provider-refund.exception';

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new ProviderRefundException('AMBIGUOUS', null);
  return value as Record<string, unknown>;
}
const REJECTIONS: ReadonlySet<number> = new Set([400, 401, 403, 404, 422]);

/** At most one POST per dispatch claim. A response confirms acceptance, never settlement. */
export class LemonSqueezyRefundAdapter implements ProviderRefundPort {
  public constructor(private readonly apiKey: string) {}
  public async dispatch(input: DispatchProviderRefund): Promise<{ providerOrderId: string }> {
    if (
      !this.apiKey ||
      !/^[1-9]\d{0,19}$/.test(input.providerOrderId) ||
      !/^[1-9]\d{0,19}$/.test(input.storeId) ||
      !/^[A-Z]{3}$/.test(input.currency) ||
      !['test', 'production'].includes(input.environment) ||
      !Number.isSafeInteger(input.amountCents) ||
      input.amountCents <= 0
    )
      throw new ProviderRefundException('REJECTED', null);
    try {
      const response = await fetch(
        `https://api.lemonsqueezy.com/v1/orders/${input.providerOrderId}/refund`,
        {
          method: 'POST',
          redirect: 'error',
          signal: AbortSignal.timeout(10_000),
          headers: {
            Accept: 'application/vnd.api+json',
            'Content-Type': 'application/vnd.api+json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            data: {
              type: 'orders',
              id: input.providerOrderId,
              attributes: { amount: input.amountCents },
            },
          }),
        },
      );
      if (!response.ok)
        throw new ProviderRefundException(
          REJECTIONS.has(response.status) ? 'REJECTED' : 'AMBIGUOUS',
          response.status,
        );
      const body: unknown = await response.json();
      const document = object(body);
      const data = object(document.data ?? document);
      const attrs = object(data.attributes);
      if (
        data.type !== 'orders' ||
        data.id !== input.providerOrderId ||
        String(attrs.store_id) !== input.storeId ||
        attrs.currency !== input.currency ||
        attrs.test_mode !== (input.environment === 'test')
      )
        throw new ProviderRefundException('AMBIGUOUS', response.status);
      return { providerOrderId: input.providerOrderId };
    } catch (error: unknown) {
      if (error instanceof ProviderRefundException) throw error;
      // No vendor body, key, contact data or arbitrary transport message escapes this boundary.
      throw new ProviderRefundException('AMBIGUOUS', null);
    }
  }
}

import type {
  CreateProviderCheckout,
  ProviderCheckout,
  ProviderCheckoutPort,
} from '@/payments/application/ports/out/provider-checkout.port';
import { ProviderCheckoutException } from '@/payments/application/exceptions/provider-checkout.exception';
import {
  isLemonSqueezyCheckoutUrl,
  providerObject,
} from '@/payments/infrastructure/lemon-squeezy-validation';

const DEFINITIVE_REJECTIONS: ReadonlySet<number> = new Set([400, 401, 403, 404, 422]);

/** A POST is sent at most once. Timeout/5xx/invalid success never imply no checkout exists. */
export class LemonSqueezyCheckoutAdapter implements ProviderCheckoutPort {
  public constructor(
    private readonly apiKey: string,
    private readonly variantId: string,
  ) {}

  public async create(input: CreateProviderCheckout): Promise<ProviderCheckout> {
    if (
      !this.apiKey ||
      !/^[1-9]\d*$/.test(this.variantId) ||
      !Number.isSafeInteger(Number(this.variantId)) ||
      !/^[1-9]\d*$/.test(input.storeId) ||
      !Number.isSafeInteger(input.amountCents) ||
      input.amountCents <= 0 ||
      !Number.isFinite(Date.parse(input.expiresAt)) ||
      !['test', 'production'].includes(input.environment)
    ) {
      throw new ProviderCheckoutException('REJECTED', 'INVALID_CONFIGURATION');
    }

    // The real API serializes expires_at to whole seconds. Round down so it can never outlive the reservation.
    const providerExpiresAt = new Date(
      Math.floor(Date.parse(input.expiresAt) / 1000) * 1000,
    ).toISOString();
    try {
      const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
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
            type: 'checkouts',
            attributes: {
              custom_price: input.amountCents,
              expires_at: providerExpiresAt,
              test_mode: input.environment === 'test',
              preview: true,
              product_options: { enabled_variants: [Number(this.variantId)] },
              checkout_options: { discount: false },
              checkout_data: {
                custom: {
                  payment_id: input.paymentId,
                  order_id: input.orderId,
                  tenant_id: input.tenantId,
                },
              },
            },
            relationships: {
              store: { data: { type: 'stores', id: input.storeId } },
              variant: { data: { type: 'variants', id: this.variantId } },
            },
          },
        }),
      });

      if (!response.ok) {
        throw new ProviderCheckoutException(
          DEFINITIVE_REJECTIONS.has(response.status) ? 'REJECTED' : 'AMBIGUOUS',
          `HTTP_${response.status}`,
        );
      }

      const body: unknown = await response.json();
      const data = providerObject(providerObject(body).data);
      const attributes = providerObject(data.attributes);
      const preview = providerObject(attributes.preview);
      if (
        data.type !== 'checkouts' ||
        typeof data.id !== 'string' ||
        data.id.length === 0 ||
        data.id.length > 128 ||
        !isLemonSqueezyCheckoutUrl(attributes.url) ||
        String(attributes.store_id) !== input.storeId ||
        String(attributes.variant_id) !== this.variantId ||
        attributes.test_mode !== (input.environment === 'test') ||
        typeof attributes.expires_at !== 'string' ||
        Date.parse(attributes.expires_at) !== Date.parse(providerExpiresAt) ||
        preview.currency !== input.currency ||
        preview.total !== input.amountCents
      ) {
        throw new ProviderCheckoutException('AMBIGUOUS', 'CHECKOUT_CONTRACT_MISMATCH');
      }
      return { checkoutId: data.id, checkoutUrl: attributes.url };
    } catch (error: unknown) {
      if (error instanceof ProviderCheckoutException) throw error;
      throw new ProviderCheckoutException('AMBIGUOUS', 'TRANSPORT_OR_RESPONSE_FAILURE', error);
    }
  }
}

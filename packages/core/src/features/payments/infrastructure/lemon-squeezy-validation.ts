import { ProviderCheckoutException } from '@/payments/application/exceptions/provider-checkout.exception';

export function providerObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ProviderCheckoutException('AMBIGUOUS', 'INVALID_RESPONSE');
  }
  return value as Record<string, unknown>;
}

export function isLemonSqueezyCheckoutUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname.endsWith('.lemonsqueezy.com') &&
      url.username === '' &&
      url.password === '' &&
      url.port === '' &&
      url.pathname.startsWith('/checkout/')
    );
  } catch {
    return false;
  }
}

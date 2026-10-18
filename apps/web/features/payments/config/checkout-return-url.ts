import { PaymentCheckoutException } from '@canaldigital/packages/core';

/** Resolve deployment configuration without trusting request headers or form fields. */
export function resolveCheckoutReturnUrl(
  env: Readonly<Record<string, string | undefined>>,
): string {
  if (env.PAYMENT_CHECKOUT_RETURN_URL) return env.PAYMENT_CHECKOUT_RETURN_URL;
  const host =
    env.VERCEL_ENV === 'production'
      ? (env.VERCEL_PROJECT_PRODUCTION_URL ?? env.VERCEL_URL)
      : env.VERCEL_URL;
  if (host) return `https://${host}/`;
  if (env.NODE_ENV !== 'production') return 'http://localhost:3000/';
  throw new PaymentCheckoutException('NOT_CONFIGURED');
}

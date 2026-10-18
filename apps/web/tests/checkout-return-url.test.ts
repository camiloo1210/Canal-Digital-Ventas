import { describe, expect, it } from 'vitest';
import { resolveCheckoutReturnUrl } from '@/features/payments/config/checkout-return-url';

describe('Checkout return URL deployment configuration', (): void => {
  it('prefers the explicitly configured public app URL', (): void => {
    expect(
      resolveCheckoutReturnUrl({
        PAYMENT_CHECKOUT_RETURN_URL: 'https://canal-digital-ventas.kirokusolutions.com/',
        VERCEL_ENV: 'production',
        VERCEL_URL: 'deployment.vercel.app',
      }),
    ).toBe('https://canal-digital-ventas.kirokusolutions.com/');
  });

  it('uses the stable production domain on Vercel', (): void => {
    expect(
      resolveCheckoutReturnUrl({
        NODE_ENV: 'production',
        VERCEL_ENV: 'production',
        VERCEL_PROJECT_PRODUCTION_URL: 'app.example.test',
        VERCEL_URL: 'deployment.vercel.app',
      }),
    ).toBe('https://app.example.test/');
  });

  it('keeps preview payments on the preview deployment', (): void => {
    expect(
      resolveCheckoutReturnUrl({
        NODE_ENV: 'production',
        VERCEL_ENV: 'preview',
        VERCEL_PROJECT_PRODUCTION_URL: 'app.example.test',
        VERCEL_URL: 'preview.vercel.app',
      }),
    ).toBe('https://preview.vercel.app/');
  });

  it('supports local development without deployment variables', (): void => {
    expect(resolveCheckoutReturnUrl({ NODE_ENV: 'development' })).toBe('http://localhost:3000/');
  });

  it('rejects an unconfigured non-Vercel production deployment', (): void => {
    expect((): string => resolveCheckoutReturnUrl({ NODE_ENV: 'production' })).toThrow();
  });
});

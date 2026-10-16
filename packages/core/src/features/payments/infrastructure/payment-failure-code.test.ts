import { describe, it, expect } from 'vitest';
import { paymentFailureCode } from '@/payments/infrastructure/payment-failure-code';
describe('Safe payment operational diagnostics', (): void => {
  it('extracts SQLSTATE through typed wrapper chains', (): void => {
    expect(
      paymentFailureCode({
        originalError: { originalError: { code: 'FZ067', detail: 'private' } },
      }),
    ).toBe('FZ067');
  });
  it('never includes connection strings, keys or arbitrary messages', (): void => {
    expect(
      paymentFailureCode({
        message: 'postgres://private:key@host/db',
        code: 'secret-value',
        originalError: { message: 'Bearer private' },
      }),
    ).toBe('UNAVAILABLE');
  });
  it('limits recursion even for cyclic causes', (): void => {
    const error: { originalError?: unknown } = {};
    error.originalError = error;
    expect(paymentFailureCode(error)).toBe('UNAVAILABLE');
  });
  it('permits a fixed HTTP status without a response body', (): void => {
    expect(paymentFailureCode({ message: 'Evidence requires HTTP 503.' })).toBe('EHTTP503');
  });
});

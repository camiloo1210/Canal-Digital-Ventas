import { describe, expect, it } from 'vitest';
import config from '@/next.config';

describe('browser security headers', (): void => {
  it('prevents framing, MIME sniffing and leaking invitation URLs through referrers', async (): Promise<void> => {
    const rules = await config.headers?.();
    const headers = rules?.find((rule): boolean => rule.source === '/:path*')?.headers ?? [];
    const values = Object.fromEntries(
      headers.map((header): [string, string] => [header.key, header.value]),
    );
    expect(values['X-Frame-Options']).toBe('DENY');
    expect(values['X-Content-Type-Options']).toBe('nosniff');
    expect(values['Referrer-Policy']).toBe('no-referrer');
    expect(values['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    expect(values['Content-Security-Policy']).toContain("object-src 'none'");
    expect(values['Content-Security-Policy']).toContain("base-uri 'self'");
  });
});

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['packages/core/src/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/*.integration.test.ts',
        '**/*.d.ts',
        '**/index.ts',
        '**/*.dto.ts',
        '**/*.port.ts',
        '**/*.fixture.ts',
        'packages/core/src/testing/**',
      ],
      reporter: ['text-summary', 'json-summary', 'lcov'],
      reportsDirectory: 'coverage',
      thresholds: {
        statements: 75,
        branches: 70,
        functions: 77,
        lines: 76,
        'packages/core/src/features/*/domain/**': {
          statements: 93,
          branches: 87,
          functions: 96,
          lines: 94,
        },
        'packages/core/src/features/*/application/**': {
          statements: 92,
          branches: 86,
          functions: 90,
          lines: 92,
        },
        'packages/core/src/features/*/infrastructure/**': {
          statements: 50,
          branches: 54,
          functions: 49,
          lines: 50,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@canaldigital/packages/core/cart-pricing': path.resolve(
        __dirname,
        'packages/core/src/features/carts/application/services/cart-quote.ts',
      ),
      '@canaldigital/packages/core/money-format': path.resolve(
        __dirname,
        'packages/core/src/features/shared/domain/money-format.ts',
      ),
      '@canaldigital/packages/core/money-limits': path.resolve(
        __dirname,
        'packages/core/src/features/shared/domain/money-limits.ts',
      ),
      'server-only': path.resolve(__dirname, 'apps/web/tests/stubs/server-only.ts'),
      '@/next.config': path.resolve(__dirname, 'apps/web/next.config.ts'),
      '@/proxy': path.resolve(__dirname, 'apps/web/proxy.ts'),
      '@/scripts': path.resolve(__dirname, 'packages/core/scripts'),
      '@/tests': path.resolve(__dirname, 'apps/web/tests'),
      '@/dashboard': path.resolve(__dirname, 'packages/core/src/features/dashboard'),
      '@/app': path.resolve(__dirname, 'apps/web/app'),
      '@/features': path.resolve(__dirname, 'apps/web/features'),
      '@/lib': path.resolve(__dirname, 'apps/web/lib'),
      '@/components': path.resolve(__dirname, 'apps/web/components'),
      '@/i18n': path.resolve(__dirname, 'apps/web/i18n'),
      '@/messages': path.resolve(__dirname, 'apps/web/messages'),
      '@/shared': path.resolve(__dirname, 'packages/core/src/features/shared'),
      '@/products': path.resolve(__dirname, 'packages/core/src/features/products'),
      '@/categories': path.resolve(__dirname, 'packages/core/src/features/categories'),
      '@/orders': path.resolve(__dirname, 'packages/core/src/features/orders'),
      '@/shipment-tracking': path.resolve(
        __dirname,
        'packages/core/src/features/shipment-tracking',
      ),
      '@/shipment-creation': path.resolve(
        __dirname,
        'packages/core/src/features/shipment-creation',
      ),
      '@/customers': path.resolve(__dirname, 'packages/core/src/features/customers'),
      '@/carts': path.resolve(__dirname, 'packages/core/src/features/carts'),
      '@/payments': path.resolve(__dirname, 'packages/core/src/features/payments'),
      '@/tenants': path.resolve(__dirname, 'packages/core/src/features/tenants'),
      '@/iam': path.resolve(__dirname, 'packages/core/src/features/iam'),
      '@/notifications': path.resolve(__dirname, 'packages/core/src/features/notifications'),
      '@/worker': path.resolve(__dirname, 'apps/worker/src'),
      '@/kivi': path.resolve(__dirname, 'packages/core/src/features/kivi'),
      '@/sales': path.resolve(__dirname, 'packages/core/src/features/sales'),
      '@/testing': path.resolve(__dirname, 'packages/core/src/testing'),
    },
  },
});

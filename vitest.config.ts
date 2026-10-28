import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
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
      '@/customers': path.resolve(__dirname, 'packages/core/src/features/customers'),
      '@/carts': path.resolve(__dirname, 'packages/core/src/features/carts'),
      '@/payments': path.resolve(__dirname, 'packages/core/src/features/payments'),
      '@/tenants': path.resolve(__dirname, 'packages/core/src/features/tenants'),
      '@/iam': path.resolve(__dirname, 'packages/core/src/features/iam'),
      '@/notifications': path.resolve(__dirname, 'packages/core/src/features/notifications'),
      '@/worker': path.resolve(__dirname, 'apps/worker/src'),
      '@/kivi': path.resolve(__dirname, 'packages/core/src/features/kivi'),
      '@/sales': path.resolve(__dirname, 'packages/core/src/features/sales'),
    },
  },
});

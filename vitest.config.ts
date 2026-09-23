import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@/features': path.resolve(__dirname, 'apps/web/features'),
      '@/lib': path.resolve(__dirname, 'apps/web/lib'),
      '@/components': path.resolve(__dirname, 'apps/web/components'),
      '@/shared': path.resolve(__dirname, 'packages/core/src/features/shared'),
      '@/products': path.resolve(__dirname, 'packages/core/src/features/products'),
      '@/categories': path.resolve(__dirname, 'packages/core/src/features/categories'),
      '@/orders': path.resolve(__dirname, 'packages/core/src/features/orders'),
      '@/customers': path.resolve(__dirname, 'packages/core/src/features/customers'),
      '@/carts': path.resolve(__dirname, 'packages/core/src/features/carts'),
      '@/payments': path.resolve(__dirname, 'packages/core/src/features/payments'),
      '@/tenants': path.resolve(__dirname, 'packages/core/src/features/tenants'),
      '@/iam': path.resolve(__dirname, 'packages/core/src/features/iam'),
      '@/sales': path.resolve(__dirname, 'packages/core/src/features/sales'),
    },
  },
});

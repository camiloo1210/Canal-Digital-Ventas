import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@/features': path.resolve(__dirname, './features'),
      '@/lib': path.resolve(__dirname, './lib'),
      '@/components': path.resolve(__dirname, './components'),
      '@/categories': path.resolve(__dirname, '../../packages/core/src/features/categories'),
      '@/products': path.resolve(__dirname, '../../packages/core/src/features/products'),
      '@/shared': path.resolve(__dirname, '../../packages/core/src/shared'),
      '@/tenants': path.resolve(__dirname, '../../packages/core/src/features/tenants'),
      '@/iam': path.resolve(__dirname, '../../packages/core/src/features/iam'),
    },
  },
  test: {
    environment: 'node',
  },
});

import { defineConfig, mergeConfig } from 'vitest/config';
// Tooling file outside the @/ alias roots: it must extend the root Vitest config by path.
// eslint-disable-next-line no-restricted-imports
import baseConfig from './vitest.config.ts';

// Vitest config used only by Stryker: core unit tests, no integration/web tests.
const strykerVitestConfig = mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ['packages/core/src/**/*.test.ts'],
      exclude: ['**/node_modules/**', '**/*.integration.test.ts', '**/*.property.test.ts'],
    },
  }),
);

export default strykerVitestConfig;

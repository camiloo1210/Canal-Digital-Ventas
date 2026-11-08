// On-demand mutation testing for the domain layer. Not part of CI.
// Usage: pnpm test:mutation [-- --mutate 'packages/core/src/features/orders/domain/**/*.ts']
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const strykerConfig = {
  testRunner: 'vitest',
  plugins: ['@stryker-mutator/vitest-runner'],
  mutate: ['packages/core/src/features/*/domain/**/*.ts', '!**/*.test.ts'],
  coverageAnalysis: 'perTest',
  thresholds: { high: 85, low: 70, break: 60 },
  reporters: ['clear-text', 'html', 'json'],
  htmlReporter: { fileName: 'reports/mutation/mutation.html' },
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  vitest: { configFile: 'stryker.vitest.config.mjs' },
  tempDirName: '.stryker-tmp',
  ignorePatterns: [
    'reports',
    'coverage',
    '.claude',
    '.agents',
    '.github',
    'docs',
    'supabase',
    'apps/web/.next',
    'apps/web/playwright-report',
    'apps/web',
    'apps/worker',
  ],
  timeoutMS: 20000,
  concurrency: 4,
};

export default strykerConfig;

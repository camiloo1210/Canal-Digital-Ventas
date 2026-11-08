import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from '@playwright/test';

const ENV_FILE = path.resolve(__dirname, '.env.e2e');
const EXAMPLE_FILE = path.resolve(__dirname, '.env.example');
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);
const LOCAL_ONLY_VARIABLES = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'DATABASE_URL',
  'PAYMENT_CHECKOUT_DATABASE_URL',
  'PAYMENT_INGESTION_DATABASE_URL',
] as const;

function parseEnvFile(file: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line);
    if (match) values[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}

function loadE2eEnvironment(): Record<string, string> {
  if (!existsSync(ENV_FILE)) {
    throw new Error(
      'Missing apps/web/.env.e2e. Run: cp apps/web/.env.e2e.example apps/web/.env.e2e (local Supabase only).',
    );
  }
  const fromFile = parseEnvFile(ENV_FILE);
  // Every key declared in .env.example is set explicitly so Next never falls back to .env.local.
  const env: Record<string, string> = {};
  for (const key of Object.keys(parseEnvFile(EXAMPLE_FILE))) env[key] = fromFile[key] ?? '';
  for (const [key, value] of Object.entries(fromFile)) env[key] = value;
  env.RATE_LIMIT_ENABLED = 'false';
  env.PAYMENTS_CHECKOUT_UI_ENABLED = 'false';
  env.KIVI_NOTIFICATIONS_ENABLED = 'false';
  env.GEMINI_API_KEY = '';

  for (const key of LOCAL_ONLY_VARIABLES) {
    const value = env[key];
    if (!value) {
      if (key === 'NEXT_PUBLIC_SUPABASE_URL' || key === 'DATABASE_URL') {
        throw new Error(`${key} is required in apps/web/.env.e2e`);
      }
      continue;
    }
    let hostname: string;
    try {
      hostname = new URL(value).hostname;
    } catch {
      throw new Error(`${key} in apps/web/.env.e2e is not a valid URL`);
    }
    if (!LOCAL_HOSTS.has(hostname)) {
      throw new Error(`Refusing to run E2E: ${key} must point to 127.0.0.1 or localhost.`);
    }
  }
  return env;
}

const e2eEnvironment = loadE2eEnvironment();
// Test workers inherit this; the simulated-payment helper re-checks it is local before connecting.
process.env.E2E_DATABASE_URL = e2eEnvironment.DATABASE_URL;
const baseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:3100';
if (!LOCAL_HOSTS.has(new URL(baseUrl).hostname)) {
  throw new Error('Refusing to run E2E: E2E_BASE_URL must point to 127.0.0.1 or localhost.');
}

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.e2e\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  // Dev mode compiles each route on first visit, which can exceed the 5 s default.
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: baseUrl,
    locale: 'es-EC',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    // `next start` forces NODE_ENV=production, where the app ignores RATE_LIMIT_ENABLED=false (fails closed
    // with 503 on /login) and marks cookies Secure (lost over http). Dev mode honours the E2E settings.
    command: 'pnpm dev -p 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: false,
    timeout: 240_000,
    env: e2eEnvironment,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /setup\/.*\.e2e\.ts/,
      // Manual contexts here race Playwright's trace cleanup (ENOENT in test-results); the flow is simple.
      use: { trace: 'off', video: 'off' },
    },
    { name: 'public', testMatch: /public\/.*\.e2e\.ts/ },
    { name: 'admin', testMatch: /admin\/.*\.e2e\.ts/, dependencies: ['setup'] },
    { name: 'buyer', testMatch: /buyer\/.*\.e2e\.ts/, dependencies: ['admin'] },
    { name: 'lifecycle', testMatch: /lifecycle\/.*\.e2e\.ts/, dependencies: ['buyer'] },
  ],
});

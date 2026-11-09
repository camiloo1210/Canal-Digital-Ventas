import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from '@playwright/test';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const EXAMPLE_FILE = path.resolve(__dirname, '.env.example');
const SUPABASE_CACHE_VARIABLE = 'E2E_LOCAL_SUPABASE';
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);
const LOCAL_ONLY_VARIABLES = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'DATABASE_URL',
  'PAYMENT_CHECKOUT_DATABASE_URL',
  'PAYMENT_INGESTION_DATABASE_URL',
] as const;

function parseEnv(text: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line);
    if (match) values[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}

/** URL, keys and database of the local Supabase stack, read from the CLI so no .env file is needed. */
function localSupabaseEnvironment(): Record<string, string> {
  const cached = process.env[SUPABASE_CACHE_VARIABLE];
  if (cached) return parseEnv(cached);
  let output: string;
  try {
    output = execFileSync('pnpm', ['supabase', 'status', '-o', 'env'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    throw new Error('Local Supabase is not running. Start it first with: pnpm supabase start');
  }
  const status = parseEnv(output);
  const values: Record<string, string> = {
    NEXT_PUBLIC_SUPABASE_URL: status.API_URL ?? '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY ?? '',
    SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY ?? '',
    DATABASE_URL: status.DB_URL ?? '',
  };
  for (const [key, value] of Object.entries(values)) {
    if (!value) throw new Error(`'pnpm supabase status' did not return a value for ${key}.`);
  }
  // Test workers are separate processes; they reuse the values instead of calling the CLI again.
  process.env[SUPABASE_CACHE_VARIABLE] = Object.entries(values)
    .map(([key, value]): string => `${key}=${value}`)
    .join('\n');
  return values;
}

function loadE2eEnvironment(): Record<string, string> {
  // Every key declared in .env.example is set explicitly so Next never falls back to .env.local.
  const env: Record<string, string> = {};
  for (const key of Object.keys(parseEnv(readFileSync(EXAMPLE_FILE, 'utf8')))) env[key] = '';
  Object.assign(env, localSupabaseEnvironment());
  env.PAYMENTS_ENVIRONMENT = 'test';
  env.PAYMENT_CHECKOUT_RETURN_URL = 'http://localhost:3100/';
  env.CATALOG_CACHE_TTL_SECONDS = '15';
  env.RATE_LIMIT_ENABLED = 'false';
  env.PAYMENTS_CHECKOUT_UI_ENABLED = 'false';
  env.KIVI_NOTIFICATIONS_ENABLED = 'false';
  env.GEMINI_API_KEY = '';
  env.TRACKING_SANDBOX_ENABLED = '';
  env.TRACKING_DEPLOYMENT_ID = '';
  env.TRACKING_TENANT_REFS_JSON = '';
  env.PRODUCTION_DATABASE_URL = '';
  if (process.env.E2E_FEDEX_SANDBOX === '1') {
    const deployment = process.env.E2E_TRACKING_DEPLOYMENT_ID ?? '';
    const refs = process.env.E2E_TRACKING_TENANT_REFS_JSON ?? '';
    const productionDatabase = process.env.E2E_PRODUCTION_DATABASE_URL ?? '';
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deployment) ||
      !refs ||
      !productionDatabase
    ) {
      throw new Error(
        'FedEx E2E requires a sandbox deployment ID, tenant references and a production database identity.',
      );
    }
    env.TRACKING_SANDBOX_ENABLED = 'true';
    env.TRACKING_DEPLOYMENT_ID = deployment;
    env.TRACKING_TENANT_REFS_JSON = refs;
    env.PRODUCTION_DATABASE_URL = productionDatabase;
  }

  for (const key of LOCAL_ONLY_VARIABLES) {
    const value = env[key];
    if (!value) {
      if (key === 'NEXT_PUBLIC_SUPABASE_URL' || key === 'DATABASE_URL') {
        throw new Error(`${key} is required (read from pnpm supabase status)`);
      }
      continue;
    }
    let hostname: string;
    try {
      hostname = new URL(value).hostname;
    } catch {
      throw new Error(`${key} from pnpm supabase status is not a valid URL`);
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

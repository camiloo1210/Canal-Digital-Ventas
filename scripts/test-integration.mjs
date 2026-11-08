#!/usr/bin/env node
// One command for the self-contained integration tests: `pnpm test:integration`.
// Starts the local Supabase stack when needed, waits for PostgreSQL, points DATABASE_URL at
// the LOCAL database only, and runs every *.integration.test.ts with the verbose reporter so
// skipped tests are listed by name.
import { spawnSync } from 'node:child_process';
import net from 'node:net';

const LOCAL_DB_HOST = '127.0.0.1';
const LOCAL_DB_PORT = 54322;
const LOCAL_DATABASE_URL = `postgresql://postgres:postgres@${LOCAL_DB_HOST}:${LOCAL_DB_PORT}/postgres`;
const READY_TIMEOUT_MS = 60_000;

// Suites gated by their own variable need dedicated worker logins, a disposable audit cluster
// or pre-existing cloud data. They are NOT enabled here and show up as skipped.
const DEDICATED_SUITE_VARIABLES = [
  'OUTBOX_TEST_DATABASE_URL (outbox relay fencing, outbox worker migrations)',
  'NOTIFICATION_TEST_DATABASE_URL (notification order projection)',
  'KIVI_TEST_DATABASE_URL (kivi sync fencing)',
  'SECURITY_TEST_DATABASE_URL (security remediation)',
  'ADMIN_CATALOG_TEST_DATABASE_URL, BUSINESS_INTELLIGENCE_TEST_DATABASE_URL, STORE_BRANDING_TEST_DATABASE_URL (need pre-existing data)',
  'RABBITMQ_TEST_URL (needs a RabbitMQ broker)',
];

function fail(message) {
  console.error(`test:integration: ${message}`);
  process.exit(1);
}

function run(command, args) {
  return spawnSync(command, args, { encoding: 'utf8', shell: false });
}

function portOpen() {
  return new Promise((resolve) => {
    const socket = net.connect({ host: LOCAL_DB_HOST, port: LOCAL_DB_PORT });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

async function waitForDatabase() {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await portOpen()) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  fail(`PostgreSQL did not become ready on ${LOCAL_DB_HOST}:${LOCAL_DB_PORT} within 60s.`);
}

const docker = run('docker', ['info']);
if (docker.error || docker.status !== 0) {
  fail(
    'Docker is not reachable. Start Docker (if it uses a user socket, set DOCKER_HOST, e.g. unix:///home/<you>/.docker/desktop/docker.sock).',
  );
}

const cli = run('pnpm', ['exec', 'supabase', '--version']);
if (cli.error || cli.status !== 0) {
  fail('The supabase CLI is not available. Run `pnpm install` or install the Supabase CLI.');
}

if (!(await portOpen())) {
  console.log('Local Supabase is not running; starting it (`pnpm exec supabase start`)...');
  const start = spawnSync('pnpm', ['exec', 'supabase', 'start'], { stdio: 'inherit' });
  if (start.status !== 0) fail('`supabase start` failed.');
}
await waitForDatabase();

console.log(`Using local database ${LOCAL_DB_HOST}:${LOCAL_DB_PORT} (DATABASE_URL).`);
console.log('Not enabled locally (listed as skipped below):');
for (const line of DEDICATED_SUITE_VARIABLES) console.log(`  - ${line}`);

const env = { ...process.env, DATABASE_URL: LOCAL_DATABASE_URL };
for (const name of Object.keys(env)) {
  if (name.endsWith('_TEST_DATABASE_URL') || name === 'RABBITMQ_TEST_URL') delete env[name];
}

const result = spawnSync(
  'pnpm',
  ['exec', 'vitest', 'run', '--reporter=verbose', '.integration.test.ts'],
  { stdio: 'inherit', env },
);
process.exit(result.status ?? 1);

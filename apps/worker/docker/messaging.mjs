// Host-side Docker tooling only. No payment or notification business logic.
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { closeSync, mkdtempSync, openSync, rmdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const compose = ['compose', '--env-file', 'apps/worker/.env', '-f', 'compose.rabbitmq.yml'];
const localImage = 'canaldigital-messaging-worker:local';
const buildkitImage =
  'moby/buildkit:v0.34.0@sha256:b059f8d7226d0b326bc871af489a5dddf65e36af4d20d14251b072974d9ee87c';

/** @returns {string} */
function docker(args, capture = false) {
  const result = spawnSync('docker', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    shell: false,
  });
  if (result.error || result.status !== 0) {
    // Captured config errors must not expose environment variable values.
    throw new Error(`Docker ${args[0]} failed; check Docker and the worker configuration.`);
  }
  return capture ? result.stdout.trim() : '';
}

/** @returns {void} */
export function build(
  image,
  execute = docker,
  lock = join(tmpdir(), 'canaldigital-worker-build.lock'),
) {
  const descriptor = openSync(lock, 'wx', 0o600);
  closeSync(descriptor);
  const builder = `cdv-build-${randomUUID()}`;
  let directory;
  let created = false;
  try {
    directory = mkdtempSync(join(tmpdir(), 'cdv-build-'));
    const config = join(directory, 'buildkitd.toml');
    writeFileSync(
      config,
      '[worker.oci]\nmax-parallelism = 1\ngc = true\nreservedSpace = "256MB"\nmaxUsedSpace = "1GB"\nminFreeSpace = "8GB"\n',
    );
    execute([
      'buildx',
      'create',
      '--name',
      builder,
      '--driver',
      'docker-container',
      '--driver-opt',
      `image=${buildkitImage}`,
      '--driver-opt',
      'memory=1536m,memory-swap=1536m,cpu-period=100000,cpu-quota=100000,restart-policy=no',
      '--buildkitd-config',
      config,
    ]);
    created = true;
    execute(['buildx', 'inspect', '--bootstrap', builder]);
    execute(['update', '--pids-limit', '256', `buildx_buildkit_${builder}0`]);
    execute([
      'buildx',
      'build',
      '--builder',
      builder,
      '--load',
      '--file',
      'apps/worker/Dockerfile',
      '--target',
      'runtime',
      '--tag',
      image,
      '.',
    ]);
  } finally {
    try {
      if (created) execute(['buildx', 'rm', '--force', builder]);
    } finally {
      // Exact paths created by this invocation; never prune shared Docker data.
      if (directory) {
        rmSync(join(directory, 'buildkitd.toml'), { force: true });
        rmdirSync(directory);
      }
      rmSync(lock);
    }
  }
}

/** @returns {string} */
export function workerImage(output) {
  // Identified by service name, so broker image updates never affect worker resolution.
  // Only the image field is read; the rest of the rendered configuration is discarded.
  let image;
  try {
    image = JSON.parse(output).services?.['outbox-worker']?.image;
  } catch {
    // Parser messages may quote the rendered configuration, which contains secrets.
    throw new Error('Expected one worker image.');
  }
  if (typeof image !== 'string' || !image) throw new Error('Expected one worker image.');
  return image;
}

/** @returns {void} */
function main() {
  const action = process.argv[2];
  if (!['up', 'build'].includes(action)) throw new Error('Usage: messaging.mjs up|build');
  // Compose resolves PAYMENTS_WORKER_IMAGE from its own env file. The rendered configuration is parsed in memory and never printed.
  const image = workerImage(docker([...compose, 'config', '--format', 'json'], true));
  if (action === 'build') {
    build(image);
    return;
  }
  const inspection = spawnSync('docker', ['image', 'inspect', image], {
    cwd: root,
    stdio: 'ignore',
  });
  if (inspection.error) throw new Error('Docker is unavailable.');
  if (inspection.status !== 0) {
    if (image === localImage) build(image);
    else docker(['pull', image]);
  }
  docker([...compose, 'up', '--no-build', '--wait', '--wait-timeout', '180', '-d']);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Messaging startup failed.');
    process.exitCode = 1;
  }
}

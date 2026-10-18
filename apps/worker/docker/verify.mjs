// Opt-in integration probes: disposable containers only; never mutate application queues.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const compose = ['compose', '--env-file', 'apps/worker/.env', '-f', 'compose.rabbitmq.yml'];
const suffix = randomUUID();
const broker = `cdv-limits-broker-${suffix}`;
const network = `cdv-limits-network-${suffix}`;
const fixtures = [];
const evidence = { checkedAt: new Date().toISOString(), checks: {} };
let networkCreated = false;
const mib = 1024 ** 2;
const buildImage = `cdv-limits-build-${suffix}:probe`;
let imageBuilt = false;
const inspection =
  '{"id":{{json .Id}},"service":{{json (index .Config.Labels "com.docker.compose.service")}},' +
  '"image":{{json .Image}},"health":{{json .State.Health.Status}},' +
  '"memory":{{.HostConfig.Memory}},"swap":{{.HostConfig.MemorySwap}},' +
  '"cpu":{{.HostConfig.NanoCpus}},"pids":{{.HostConfig.PidsLimit}},' +
  '"restart":{{json .HostConfig.RestartPolicy}},"logs":{{json .HostConfig.LogConfig}},' +
  '"ports":{{json .HostConfig.PortBindings}},"mounts":{{json .Mounts}}}';

/** @returns {import('node:child_process').SpawnSyncReturns<string>} */
function run(args, required = true, timeout = 30000) {
  const result = spawnSync('docker', args, { cwd: root, encoding: 'utf8', timeout, shell: false });
  if (required && (result.error || result.status !== 0)) {
    // No vendor payloads or container environment are printed.
    throw new Error(`Docker ${args[0]} ${args[1] ?? ''} failed during isolated verification.`);
  }
  return result;
}

/** @returns {object[]} */
function snapshot() {
  const ids = run([...compose, 'ps', '-q'])
    .stdout.trim()
    .split(/\s+/)
    .filter(Boolean);
  assert.equal(ids.length, 10, 'Start all ten services before verification');
  return run(['inspect', '--format', inspection, ...ids])
    .stdout.trim()
    .split('\n')
    .map((line) => JSON.parse(line));
}

/** @returns {Promise<void>} */
async function until(check, message, timeout = 60000) {
  const deadline = Date.now() + timeout;
  while (!check()) {
    assert.ok(Date.now() < deadline, message);
    await delay(500);
  }
}

/** @returns {import('node:child_process').SpawnSyncReturns<string>} */
function brokerCommand(args) {
  return run(['exec', '--user', 'rabbitmq', broker, ...args]);
}

/** @returns {string} */
function alarms() {
  return brokerCommand(['rabbitmqctl', 'eval', 'rabbit_alarm:get_alarms().']).stdout;
}

/** @returns {object} */
function publish(image, password, expectBlocked) {
  const name = `cdv-limits-client-${randomUUID()}`;
  fixtures.push(name);
  const code = `
    import amqp from 'amqplib';
    setTimeout(() => process.exit(9), 12000).unref();
    const connection = await amqp.connect(process.env.FIXTURE_URL);
    let blocked = false;
    let confirmed = false;
    connection.on('blocked', () => { blocked = true; });
    connection.on('error', () => {});
    const channel = await connection.createConfirmChannel();
    await channel.assertQueue('limits.probe', { durable: true });
    channel.sendToQueue('limits.probe', Buffer.from('isolated probe'), { persistent: true },
      error => { confirmed = !error; });
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log(JSON.stringify({ blocked, confirmed }));
    process.exit(0);
  `;
  const result = run(
    [
      'run',
      '--rm',
      '--name',
      name,
      '--network',
      `container:${broker}`,
      '--memory',
      '128m',
      '--memory-swap',
      '128m',
      '--cpus',
      '0.5',
      '--pids-limit',
      '64',
      '--entrypoint',
      'node',
      '-w',
      '/app/packages/core',
      '-e',
      `FIXTURE_URL=amqp://fixture:${password}@127.0.0.1:5672/%2F`,
      image,
      '--input-type=module',
      '-e',
      code,
    ],
    false,
  );
  assert.equal(
    result.status,
    0,
    `Isolated AMQP client failed: ${result.stderr.replaceAll(password, '[fixture-password]').slice(-3000)}`,
  );
  const value = JSON.parse(result.stdout);
  assert.equal(value.confirmed, !expectBlocked, 'Unexpected publisher confirm under broker alarm');
  if (expectBlocked) assert.equal(value.blocked, true, 'Broker must notify blocked publisher');
  return value;
}

/** @returns {Promise<void>} */
async function main() {
  assert.equal(
    run(['info', '--format', '{{.OSType}}/{{.CgroupVersion}}']).stdout.trim(),
    'linux/2',
    'Integration probes require a Linux Docker engine with cgroup v2',
  );
  const before = snapshot();
  let total = 0;
  for (const container of before) {
    const isBroker = container.service === 'rabbitmq';
    assert.equal(container.health, 'healthy', `${container.service} must be healthy`);
    assert.equal(container.memory, (isBroker ? 768 : 256) * mib);
    assert.equal(container.swap, container.memory, 'Swap must be disabled');
    assert.equal(container.cpu, isBroker ? 1e9 : 5e8);
    assert.equal(container.pids, isBroker ? 512 : 128);
    assert.deepEqual(container.restart, { Name: 'unless-stopped', MaximumRetryCount: 0 });
    assert.equal(Object.keys(container.ports ?? {}).length, 0, 'No public host ports');
    assert.equal(container.logs.Type, 'json-file');
    assert.equal(container.logs.Config['max-size'], '10m');
    assert.equal(container.logs.Config['max-file'], '3');
    assert.ok(
      !container.mounts.some((mount) => /docker\.sock/.test(mount.Source + mount.Destination)),
    );
    total += container.memory;
  }
  assert.equal(total, 3072 * mib);
  const image = before.find((container) => container.service === 'outbox-worker').image;
  const rabbitImage = before.find((container) => container.service === 'rabbitmq').image;
  evidence.checks.effectiveLimits = {
    services: before.length,
    totalMemoryMiB: total / mib,
    swap: 0,
    publicPorts: 0,
  };
  console.log('PASS: effective limits of all ten running services');

  if (process.argv.includes('--build')) {
    const { build } = await import(
      pathToFileURL(resolve(root, 'apps/worker/docker/messaging.mjs')).href
    );
    build(buildImage, (args) => {
      const result = run(args, true, 900000);
      if (args[0] === 'update') {
        const limits = JSON.parse(
          run([
            'inspect',
            '--format',
            '{"memory":{{.HostConfig.Memory}},"swap":{{.HostConfig.MemorySwap}},"quota":{{.HostConfig.CpuQuota}},"period":{{.HostConfig.CpuPeriod}},"pids":{{.HostConfig.PidsLimit}}}',
            args.at(-1),
          ]).stdout,
        );
        assert.deepEqual(limits, {
          memory: 1536 * mib,
          swap: 1536 * mib,
          quota: 100000,
          period: 100000,
          pids: 256,
        });
        evidence.checks.builderLimits = limits;
      }
      if (args[0] === 'buildx' && args[1] === 'build') imageBuilt = true;
      return result.stdout.trim();
    });
    evidence.checks.boundedBuildCompleted = true;
    console.log('PASS: real build with 1536 MiB, no swap, 1 CPU and 256 processes');
  }

  const oom = `cdv-limits-oom-${suffix}`;
  const allocate = `
    const fs = require('fs');
    const actual = Object.fromEntries(['memory.max','memory.swap.max','pids.max','cpu.max']
      .map(name => [name, fs.readFileSync('/sys/fs/cgroup/' + name,'utf8').trim()]));
    if (actual['memory.max'] !== '50331648' || actual['memory.swap.max'] !== '0'
        || actual['pids.max'] !== '32' || actual['cpu.max'] !== '25000 100000') process.exit(2);
    const retained = [];
    setInterval(() => retained.push(Buffer.alloc(4*1024*1024,1)), 30);
  `;
  run([
    'create',
    '--name',
    oom,
    '--network',
    'none',
    '--read-only',
    '--memory',
    '48m',
    '--memory-swap',
    '48m',
    '--cpus',
    '0.25',
    '--pids-limit',
    '32',
    '--ulimit',
    'core=0',
    '--entrypoint',
    'node',
    image,
    '-e',
    allocate,
  ]);
  fixtures.push(oom);
  run(['start', '--attach', oom], false, 20000);
  const oomState = JSON.parse(run(['inspect', '--format', '{{json .State}}', oom]).stdout);
  assert.equal(oomState.OOMKilled, true);
  assert.equal(oomState.ExitCode, 137);
  evidence.checks.isolatedOom = {
    memoryMiB: 48,
    swap: 0,
    cpu: 0.25,
    pids: 32,
    oomKilled: true,
    exitCode: 137,
  };
  console.log('PASS: kernel kills only the isolated container exceeding 48 MiB');

  run(['network', 'create', '--internal', network]);
  networkCreated = true;
  const password = randomUUID().replaceAll('-', '');
  run([
    'create',
    '--name',
    broker,
    '--hostname',
    'limits-fixture',
    '--network',
    network,
    '--memory',
    '768m',
    '--memory-swap',
    '768m',
    '--cpus',
    '1',
    '--pids-limit',
    '512',
    '--ulimit',
    'core=0',
    '--cap-drop',
    'ALL',
    '--cap-add',
    'CHOWN',
    '--cap-add',
    'SETUID',
    '--cap-add',
    'SETGID',
    '--security-opt',
    'no-new-privileges:true',
    '--mount',
    `type=bind,source=${resolve(root, 'apps/worker/docker/rabbitmq.conf')},target=/etc/rabbitmq/conf.d/20-resource-limits.conf,readonly`,
    '-e',
    'RABBITMQ_DEFAULT_USER=fixture',
    '-e',
    `RABBITMQ_DEFAULT_PASS=${password}`,
    '-e',
    'RABBITMQ_SERVER_ADDITIONAL_ERL_ARGS=+S 2:2',
    rabbitImage,
  ]);
  fixtures.push(broker);
  run(['start', broker]);
  await until(
    () =>
      run(['exec', '--user', 'rabbitmq', broker, 'rabbitmq-diagnostics', '-q', 'ping'], false, 8000)
        .status === 0,
    'Isolated RabbitMQ did not start',
  );
  await until(
    () =>
      run(
        ['exec', '--user', 'rabbitmq', broker, 'rabbitmq-diagnostics', '-q', 'check_running'],
        false,
        8000,
      ).status === 0,
    'Isolated RabbitMQ application did not become ready',
  );
  const ownership = run([
    'exec',
    broker,
    'stat',
    '-c',
    '%U:%G',
    '/var/lib/rabbitmq/.erlang.cookie',
  ]).stdout.trim();
  assert.equal(
    ownership,
    'rabbitmq:rabbitmq',
    'Diagnostic probes must not create a root-owned cookie',
  );
  assert.match(
    brokerCommand(['rabbitmqctl', 'eval', 'application:get_env(rabbit, vm_memory_high_watermark).'])
      .stdout,
    /384MiB/,
  );
  assert.match(
    brokerCommand(['rabbitmqctl', 'eval', 'application:get_env(rabbit, disk_free_limit).']).stdout,
    /2GB/,
  );
  evidence.checks.baselinePublish = publish(image, password, false);
  brokerCommand(['rabbitmqctl', 'set_vm_memory_high_watermark', 'absolute', '1MiB']);
  await until(() => alarms().includes('memory'), 'Memory alarm did not activate');
  evidence.checks.memoryAlarm = publish(image, password, true);
  brokerCommand(['rabbitmqctl', 'set_vm_memory_high_watermark', 'absolute', '384MiB']);
  await until(() => !alarms().includes('memory'), 'Memory alarm did not clear');
  evidence.checks.memoryRecovery = publish(image, password, false);
  console.log('PASS: memory alarm blocks confirms; publishing recovers after clearing');
  brokerCommand(['rabbitmqctl', 'set_disk_free_limit', '1000000000000000']);
  await until(() => alarms().includes('disk'), 'Disk alarm did not activate');
  evidence.checks.diskAlarm = publish(image, password, true);
  brokerCommand(['rabbitmqctl', 'set_disk_free_limit', '2GB']);
  await until(() => !alarms().includes('disk'), 'Disk alarm did not clear');
  evidence.checks.diskRecovery = publish(image, password, false);
  console.log('PASS: disk alarm blocks confirms; publishing recovers after clearing');
  const after = snapshot();
  assert.deepEqual(
    after.map((container) => container.id).sort(),
    before.map((container) => container.id).sort(),
  );
  assert.ok(after.every((container) => container.health === 'healthy'));
  evidence.checks.applicationUnaffected = true;
}

try {
  await main();
} catch (error) {
  evidence.failure = error instanceof Error ? error.message : 'Verification failed';
  process.exitCode = 1;
} finally {
  const cleanupFailures = [];
  for (const name of fixtures.reverse()) {
    // Only exact UUID names created by this run, including their anonymous test volumes.
    const result = run(['rm', '-f', '-v', name], false);
    if (result.status !== 0 && run(['inspect', name], false).status === 0)
      cleanupFailures.push(name);
  }
  if (networkCreated && run(['network', 'rm', network], false).status !== 0)
    cleanupFailures.push(network);
  if (imageBuilt && run(['image', 'rm', buildImage], false).status !== 0)
    cleanupFailures.push(buildImage);
  evidence.cleanup = { passed: cleanupFailures.length === 0, remaining: cleanupFailures };
  if (cleanupFailures.length) process.exitCode = 1;
  mkdirSync(resolve(root, '.local/host-safety'), { recursive: true });
  writeFileSync(
    resolve(root, '.local/host-safety/node-runtime-evidence.json'),
    JSON.stringify(evidence, null, 2),
  );
  console.log(JSON.stringify(evidence, null, 2));
}

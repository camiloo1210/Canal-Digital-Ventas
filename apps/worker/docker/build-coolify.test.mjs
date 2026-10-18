import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';

/** @returns {string} */
function shellPath(path) {
  return path
    .replaceAll('\\', '/')
    .replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`);
}

/** @returns {{status: number | null, commands: string}} */
function probe(scenario) {
  const directory = mkdtempSync(join(tmpdir(), 'cdv-coolify-build-'));
  try {
    const bin = join(directory, 'bin');
    const log = join(directory, 'commands.log');
    mkdirSync(bin);
    writeFileSync(log, '');
    writeFileSync(
      join(bin, 'df'),
      `#!/usr/bin/env bash
echo 'Filesystem 1024-blocks Used Available Capacity Mounted'
if [[ "$MOCK_SCENARIO" == disk ]]; then echo 'fixture 10000000 9999999 1 99% /';
else echo 'fixture 20000000 1000000 19000000 5% /'; fi
`,
      { mode: 0o755 },
    );
    writeFileSync(
      join(bin, 'docker'),
      `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$MOCK_LOG"
case "$1 $2" in
  'info --format') echo 'linux/2';;
  'buildx create') [[ "$MOCK_SCENARIO" != conflict ]] || exit 1;;
  'inspect --format')
    if [[ "$MOCK_SCENARIO" == limits ]]; then echo '0/0/0/0/0';
    else echo '1610612736/1610612736/100000/100000/256'; fi;;
  'buildx build') [[ "$MOCK_SCENARIO" != failure ]] || exit 1;;
esac
exit 0
`,
      { mode: 0o755 },
    );
    const result = spawnSync(
      bash,
      [
        '-c',
        'export PATH="$1:$PATH"; exec bash "$2"',
        'fixture',
        shellPath(bin),
        shellPath(resolve('apps/worker/docker/build-coolify.sh')),
      ],
      {
        env: {
          ...process.env,
          MOCK_LOG: shellPath(log),
          MOCK_SCENARIO: scenario,
          COOLIFY_RESOURCE_UUID: 'fixture',
        },
        encoding: 'utf8',
        timeout: 15000,
      },
    );
    if (result.error) throw result.error;
    return { status: result.status, commands: readFileSync(log, 'utf8') };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe('Coolify bounded build failure containment', () => {
  it('refuses to start Docker when the temporary filesystem has insufficient space', () => {
    const result = probe('disk');
    expect(result.status).not.toBe(0);
    expect(result.commands).toBe('');
  });

  it('cleans its builder after a failed build without pruning shared Docker resources', () => {
    const result = probe('failure');
    expect(result.status).not.toBe(0);
    expect(result.commands).toContain('buildx build');
    expect(result.commands).toContain('buildx rm --force cdv-coolify-fixture');
    expect(result.commands).not.toContain('prune');
  });

  it('refuses to build when Docker did not apply the resource limits', () => {
    const result = probe('limits');
    expect(result.status).not.toBe(0);
    expect(result.commands).not.toContain('buildx build');
    expect(result.commands).toContain('buildx rm --force cdv-coolify-fixture');
  });

  it('does not remove a builder owned by an overlapping deployment', () => {
    const result = probe('conflict');
    expect(result.status).not.toBe(0);
    expect(result.commands).not.toContain('buildx build');
    expect(result.commands).not.toContain('buildx rm');
  });
});

import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const { build: buildImage, workerImage } = await import(
  pathToFileURL(resolve('apps/worker/docker/messaging.mjs')).href
);
const lock = join(tmpdir(), `cdv-test-build-${randomUUID()}.lock`);

/** @returns {void} */
function build(image, execute) {
  buildImage(image, execute, lock);
}

describe('bounded worker image construction', () => {
  it('resolves the worker image by service name, ignoring the broker image', () => {
    const config = (services) => JSON.stringify({ services });
    expect(
      workerImage(
        config({ rabbitmq: { image: 'rabbitmq:any' }, 'outbox-worker': { image: 'fixture:local' } }),
      ),
    ).toBe('fixture:local');
    expect(() => workerImage(config({ rabbitmq: { image: 'rabbitmq:any' } }))).toThrow(
      'Expected one worker image',
    );
  });

  it('cleans only its builder after a failed image build and releases its lock', () => {
    const commands = [];
    expect(() =>
      build('fixture:local', (args) => {
        commands.push(args);
        if (args[0] === 'buildx' && args[1] === 'build') throw new Error('fixture failure');
      }),
    ).toThrow('fixture failure');
    const name = commands[0][commands[0].indexOf('--name') + 1];
    expect(commands[0]).toContain(
      'memory=1536m,memory-swap=1536m,cpu-period=100000,cpu-quota=100000,restart-policy=no',
    );
    expect(commands.at(-1)).toEqual(['buildx', 'rm', '--force', name]);
    // A new invocation must succeed after the failed build released the lock.
    expect(() => build('fixture:local', () => '')).not.toThrow();
  });

  it('rejects concurrent builds without deleting the active builder or lock', () => {
    let nested = false;
    build('fixture:local', () => {
      if (!nested) {
        nested = true;
        expect(() => build('fixture:other', () => '')).toThrow();
      }
      return '';
    });
    expect(nested).toBe(true);
    expect(() => build('fixture:local', () => '')).not.toThrow();
  });
});

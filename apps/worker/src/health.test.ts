import { describe, expect, it } from 'vitest';
import { startWorkerHealth, loadWorkerHealthPort } from '@/worker/health';

describe('Worker readiness endpoint', (): void => {
  it('stays unhealthy until dependencies are ready and becomes unhealthy on disconnect', async (): Promise<void> => {
    const health = await startWorkerHealth(0);
    try {
      expect((await fetch(`${health.url}/health`)).status).toBe(503);
      health.setReady(true);
      const ready = await fetch(`${health.url}/health`);
      expect(ready.status).toBe(200);
      expect(await ready.json()).toEqual({ ready: true });
      health.setReady(false);
      expect((await fetch(`${health.url}/health`)).status).toBe(503);
      expect((await fetch(`${health.url}/other`)).status).toBe(404);
    } finally {
      await health.close();
    }
  });

  it('rejects invalid configured health ports', (): void => {
    for (const port of ['0', '-1', '1.5', '65536', 'NaN']) {
      expect((): number => loadWorkerHealthPort({ WORKER_HEALTH_PORT: port }, 8081)).toThrow(
        'WORKER_HEALTH_PORT',
      );
    }
    expect(loadWorkerHealthPort({}, 8081)).toBe(8081);
  });
});

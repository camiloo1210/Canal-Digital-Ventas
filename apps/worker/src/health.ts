import { createServer } from 'node:http';
import { MessagingException } from '@canaldigital/packages/core';

export interface WorkerHealth {
  url: string;
  setReady(ready: boolean): void;
  close(): Promise<void>;
}

export function loadWorkerHealthPort(
  env: Record<string, string | undefined>,
  defaultPort: number,
): number {
  const port = Number(env.WORKER_HEALTH_PORT ?? defaultPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new MessagingException('Invalid WORKER_HEALTH_PORT');
  }
  return port;
}

export async function startWorkerHealth(port: number): Promise<WorkerHealth> {
  let ready = false;
  const server = createServer((request, response): void => {
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Cache-Control', 'no-store');
    if (request.url !== '/health') {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(ready ? 200 : 503).end(JSON.stringify({ ready }));
  });
  await new Promise<void>((resolve, reject): void => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', (): void => {
      server.removeListener('error', reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new MessagingException('Worker health endpoint is unavailable');
  return {
    url: `http://127.0.0.1:${address.port}`,
    setReady: (value: boolean): void => {
      ready = value;
    },
    close: async (): Promise<void> => {
      ready = false;
      server.closeIdleConnections();
      await new Promise<void>((resolve, reject): void => {
        server.close((error?: Error): void => {
          if (error) reject(error);
          else resolve();
        });
      });
    },
  };
}

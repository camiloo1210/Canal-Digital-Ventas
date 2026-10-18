import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { PaymentEvidenceEgressPort } from '@/payments/application/ports/out/refund-reconciliation.port';
import { PaymentRepositoryException } from '@/payments/application/exceptions/payment-repository.exception';

async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const part of request) {
    const chunk: Buffer = Buffer.isBuffer(part) ? part : Buffer.from(String(part));
    size += chunk.length;
    if (size > 4096) throw new PaymentRepositoryException('Request too large.');
    chunks.push(chunk);
  }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new PaymentRepositoryException('Invalid request.');
  return value as Record<string, unknown>;
}
export async function startPaymentEvidenceServer(
  port: number,
  token: string,
  egress: PaymentEvidenceEgressPort,
  onFailure: (error: unknown) => void = (): void => {},
): Promise<{ close(): Promise<void> }> {
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || !/^[a-f0-9]{64}$/.test(token))
    throw new PaymentRepositoryException('Invalid evidence service configuration.');
  let active = false;
  const respond = (
    response: ServerResponse,
    status: number,
    payload: Record<string, unknown>,
  ): void => {
    response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify(payload));
  };
  const server = createServer((request: IncomingMessage, response: ServerResponse): void => {
    void (async (): Promise<void> => {
      if (request.method !== 'POST' || request.url !== '/verify') {
        respond(response, 404, {});
        return;
      }
      const digest = (value: string): Buffer => createHash('sha256').update(value).digest();
      if (
        !timingSafeEqual(digest(request.headers.authorization ?? ''), digest(`Bearer ${token}`))
      ) {
        respond(response, 401, {});
        return;
      }
      if (active) {
        respond(response, 503, {});
        return;
      }
      active = true;
      try {
        const value = await body(request);
        const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
        if (
          typeof value.ticketId !== 'string' ||
          !uuid.test(value.ticketId) ||
          typeof value.workerToken !== 'string' ||
          !uuid.test(value.workerToken) ||
          typeof value.url !== 'string' ||
          (value.environment !== 'test' && value.environment !== 'production')
        ) {
          respond(response, 400, {});
          return;
        }
        const verificationId = await egress.verify(
          { ticketId: value.ticketId, url: value.url, environment: value.environment },
          value.workerToken,
        );
        respond(response, 200, { verificationId });
      } catch (error: unknown) {
        onFailure(error);
        respond(response, 503, {});
      } finally {
        active = false;
      }
    })().catch((): void => {
      if (!response.headersSent) respond(response, 503, {});
      else response.destroy();
    });
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.timeout = 20000;
  await new Promise<void>((resolve, reject): void => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', (): void => {
      server.removeListener('error', reject);
      resolve();
    });
  });
  return {
    close: (): Promise<void> =>
      new Promise<void>((resolve, reject): void => {
        server.close((error?: Error): void => {
          if (error) reject(error);
          else resolve();
        });
        server.closeIdleConnections();
      }),
  };
}

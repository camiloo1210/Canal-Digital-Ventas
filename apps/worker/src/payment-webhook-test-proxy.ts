import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

// Public test tunnel terminates here. No page, Auth route, file, debugger or other API is forwarded.
const server = createServer((request: IncomingMessage, response: ServerResponse): void => {
  void (async (): Promise<void> => {
    if (request.method !== 'POST' || request.url !== '/api/webhooks/lemon-squeezy') {
      response.writeHead(404);
      response.end();
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const part of request) {
      const chunk: Buffer = Buffer.isBuffer(part) ? part : Buffer.from(String(part));
      size += chunk.length;
      if (size > 1048576) {
        response.writeHead(413);
        response.end();
        return;
      }
      chunks.push(chunk);
    }
    const signature = request.headers['x-signature'];
    const event = request.headers['x-event-name'];
    if (typeof signature !== 'string' || typeof event !== 'string') {
      response.writeHead(400);
      response.end();
      return;
    }
    const result = await fetch('http://127.0.0.1:3000/api/webhooks/lemon-squeezy', {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(20000),
      headers: {
        'content-type': 'application/json',
        'x-signature': signature,
        'x-event-name': event,
      },
      body: Buffer.concat(chunks),
    });
    response.writeHead(result.status, {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    });
    response.end(await result.text());
  })().catch((): void => {
    if (!response.headersSent) response.writeHead(503);
    response.end();
  });
});
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.timeout = 25000;
server.listen(8091, '127.0.0.1', (): void => {
  console.log('Webhook-only test proxy listening on 127.0.0.1:8091');
});
const stop = (): void => {
  server.close();
  server.closeIdleConnections();
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

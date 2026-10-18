import { createHash } from 'node:crypto';
import type {
  PaymentEgressTicket,
  PaymentEvidenceEgressPort,
} from '@/payments/application/ports/out/refund-reconciliation.port';
import type { PaymentEvidenceRecorderPort } from '@/payments/application/ports/out/payment-evidence-recorder.port';
import { PaymentRepositoryException } from '@/payments/application/exceptions/payment-repository.exception';

/** The composition root supplies only an evidence-recorder role; no financial writer is available here. */
export class LemonSqueezyEvidenceEgressAdapter implements PaymentEvidenceEgressPort {
  public constructor(
    private readonly apiKey: string,
    private readonly environment: 'test' | 'production',
    private readonly recorder: PaymentEvidenceRecorderPort,
  ) {}
  public async verify(ticket: PaymentEgressTicket, workerToken: string): Promise<string> {
    if (
      !this.apiKey ||
      ticket.environment !== this.environment ||
      !/^https:\/\/api\.lemonsqueezy\.com\/v1\/orders\/[1-9]\d{0,19}$/.test(ticket.url)
    )
      throw new PaymentRepositoryException('Invalid evidence request.');
    try {
      const response = await fetch(ticket.url, {
        method: 'GET',
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
        headers: { Accept: 'application/vnd.api+json', Authorization: `Bearer ${this.apiKey}` },
      });
      if (response.status !== 200 || !response.body)
        throw new PaymentRepositoryException(`Evidence requires HTTP ${response.status}.`);
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.byteLength;
          if (size > 1048576) {
            await reader.cancel();
            throw new PaymentRepositoryException('Evidence response exceeds limit.');
          }
          chunks.push(part.value);
        }
      } finally {
        reader.releaseLock();
      }
      if (size === 0) throw new PaymentRepositoryException('Evidence response is empty.');
      const payload = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        payload.set(chunk, offset);
        offset += chunk.byteLength;
      }
      const headers: Record<string, string> = {};
      for (const key of ['date', 'etag', 'content-type', 'x-request-id', 'request-id']) {
        const value = response.headers.get(key);
        if (value !== null) headers[key] = value;
      }
      return await this.recorder.record({
        ticketId: ticket.ticketId,
        workerToken,
        url: ticket.url,
        httpStatus: 200,
        payload,
        sha256: createHash('sha256').update(payload).digest('hex'),
        headers,
      });
    } catch (error: unknown) {
      if (error instanceof PaymentRepositoryException) throw error;
      throw new PaymentRepositoryException('Provider evidence could not be recorded.');
    }
  }
}

import type {
  PaymentEgressTicket,
  PaymentEvidenceEgressPort,
} from '@/payments/application/ports/out/refund-reconciliation.port';
import { PaymentRepositoryException } from '@/payments/application/exceptions/payment-repository.exception';

/** Internal localhost transport. The caller receives only an evidence id, never raw provider data or API credentials. */
export class LocalPaymentEvidenceClientAdapter implements PaymentEvidenceEgressPort {
  public constructor(
    private readonly port: number,
    private readonly token: string,
  ) {}
  public async verify(ticket: PaymentEgressTicket, workerToken: string): Promise<string> {
    if (
      !Number.isInteger(this.port) ||
      this.port < 1024 ||
      this.port > 65535 ||
      !/^[a-f0-9]{64}$/.test(this.token)
    )
      throw new PaymentRepositoryException('Evidence service is not configured.');
    try {
      const response = await fetch(`http://127.0.0.1:${this.port}/verify`, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.token}` },
        body: JSON.stringify({ ...ticket, workerToken }),
      });
      if (response.status !== 200)
        throw new PaymentRepositoryException('Evidence service unavailable.');
      const result: unknown = await response.json();
      if (
        typeof result !== 'object' ||
        result === null ||
        !('verificationId' in result) ||
        typeof result.verificationId !== 'string' ||
        !/^[a-f0-9-]{36}$/.test(result.verificationId)
      )
        throw new PaymentRepositoryException('Invalid evidence service receipt.');
      return result.verificationId;
    } catch {
      throw new PaymentRepositoryException('Independent evidence service failed.');
    }
  }
}

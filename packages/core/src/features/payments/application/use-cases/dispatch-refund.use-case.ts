import type { RefundDispatchPort } from '@/payments/application/ports/out/refund-dispatch.port';
import type { ProviderRefundPort } from '@/payments/application/ports/out/provider-refund.port';
import { ProviderRefundException } from '@/payments/application/exceptions/provider-refund.exception';

export class DispatchRefundUseCase {
  public constructor(
    private readonly repository: RefundDispatchPort,
    private readonly provider: ProviderRefundPort,
  ) {}
  public async execute(
    workerToken: string,
  ): Promise<'IDLE' | 'REQUEST_ACCEPTED' | 'REJECTED' | 'AMBIGUOUS'> {
    const claim = await this.repository.claim(workerToken);
    if (claim === null) return 'IDLE';
    let response: { providerOrderId: string };
    try {
      response = await this.provider.dispatch(claim);
    } catch (error: unknown) {
      if (
        error instanceof ProviderRefundException &&
        error.outcome === 'REJECTED' &&
        error.httpStatus !== null &&
        [400, 401, 403, 404, 422].includes(error.httpStatus)
      ) {
        await this.repository.markRejected(claim.operationId, workerToken, error.httpStatus);
        return 'REJECTED';
      }
      await this.repository.markAmbiguous(claim.operationId, workerToken);
      return 'AMBIGUOUS';
    }
    // A database acknowledgement failure is recovered by the lease sweeper, never by a second POST.
    await this.repository.markSubmitted(claim.operationId, workerToken, response.providerOrderId);
    return 'REQUEST_ACCEPTED';
  }
}

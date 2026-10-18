import { describe, expect, it, vi } from 'vitest';
import { DispatchRefundUseCase } from '@/payments/application/use-cases/dispatch-refund.use-case';
import { ProviderRefundException } from '@/payments/application/exceptions/provider-refund.exception';
import type { RefundDispatchPort } from '@/payments/application/ports/out/refund-dispatch.port';
import type { ProviderRefundPort } from '@/payments/application/ports/out/provider-refund.port';

function fixture(): { repository: RefundDispatchPort; provider: ProviderRefundPort } {
  return {
    repository: {
      claim: vi.fn().mockResolvedValue({
        operationId: 'operation',
        paymentId: 'payment',
        providerOrderId: '123',
        storeId: '12',
        currency: 'USD',
        environment: 'test',
        amountCents: 500,
      }),
      markSubmitted: vi.fn().mockResolvedValue(undefined),
      markAmbiguous: vi.fn().mockResolvedValue(undefined),
      markRejected: vi.fn().mockResolvedValue(undefined),
    },
    provider: { dispatch: vi.fn().mockResolvedValue({ providerOrderId: '123' }) },
  };
}
describe('Refund dispatch orchestration', (): void => {
  it('claims and commits DISPATCHING before sending a single POST', async (): Promise<void> => {
    const { repository, provider } = fixture();
    await expect(new DispatchRefundUseCase(repository, provider).execute('worker')).resolves.toBe(
      'REQUEST_ACCEPTED',
    );
    expect(repository.claim).toHaveBeenCalledWith('worker');
    expect(provider.dispatch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(repository.claim).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(provider.dispatch).mock.invocationCallOrder[0],
    );
    expect(repository.markSubmitted).toHaveBeenCalledWith('operation', 'worker', '123');
  });
  it('does not send anything without a claim', async (): Promise<void> => {
    const { repository, provider } = fixture();
    vi.mocked(repository.claim).mockResolvedValue(null);
    await expect(new DispatchRefundUseCase(repository, provider).execute('worker')).resolves.toBe(
      'IDLE',
    );
    expect(provider.dispatch).not.toHaveBeenCalled();
  });
  it('does not reinterpret an acknowledgement database failure as a gateway rejection', async (): Promise<void> => {
    const { repository, provider } = fixture();
    vi.mocked(repository.markSubmitted).mockRejectedValue(new Error('db unavailable'));
    await expect(new DispatchRefundUseCase(repository, provider).execute('worker')).rejects.toThrow(
      'db unavailable',
    );
    expect(provider.dispatch).toHaveBeenCalledTimes(1);
    expect(repository.markRejected).not.toHaveBeenCalled();
    expect(repository.markAmbiguous).not.toHaveBeenCalled();
  });
  it('persists ambiguity when the provider times out', async (): Promise<void> => {
    const { repository, provider } = fixture();
    vi.mocked(provider.dispatch).mockRejectedValue(new ProviderRefundException('AMBIGUOUS', 504));
    await expect(new DispatchRefundUseCase(repository, provider).execute('worker')).resolves.toBe(
      'AMBIGUOUS',
    );
    expect(repository.markAmbiguous).toHaveBeenCalledWith('operation', 'worker');
    expect(repository.markSubmitted).not.toHaveBeenCalled();
  });
  it('records only definitive HTTP rejection codes', async (): Promise<void> => {
    const { repository, provider } = fixture();
    vi.mocked(provider.dispatch).mockRejectedValue(new ProviderRefundException('REJECTED', 422));
    await expect(new DispatchRefundUseCase(repository, provider).execute('worker')).resolves.toBe(
      'REJECTED',
    );
    expect(repository.markRejected).toHaveBeenCalledWith('operation', 'worker', 422);
  });
  it('retains an open exposure after an unexpected adapter failure', async (): Promise<void> => {
    const { repository, provider } = fixture();
    vi.mocked(provider.dispatch).mockRejectedValue(new Error('unexpected'));
    await expect(new DispatchRefundUseCase(repository, provider).execute('worker')).resolves.toBe(
      'AMBIGUOUS',
    );
    expect(repository.markAmbiguous).toHaveBeenCalledTimes(1);
  });
});

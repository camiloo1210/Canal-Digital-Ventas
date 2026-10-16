import { describe, expect, it, vi } from 'vitest';
import type { PaymentInboxProcessingPort } from '@/payments/application/ports/out/payment-inbox-processing.port';
import { ProcessPaymentInboxUseCase } from '@/payments/application/use-cases/process-payment-inbox.use-case';

function setup(): { port: PaymentInboxProcessingPort; useCase: ProcessPaymentInboxUseCase } {
  const port: PaymentInboxProcessingPort = {
    claim: vi.fn<PaymentInboxProcessingPort['claim']>().mockResolvedValue('event'),
    settle: vi.fn<PaymentInboxProcessingPort['settle']>().mockResolvedValue('COMPLETED'),
    fail: vi.fn<PaymentInboxProcessingPort['fail']>().mockResolvedValue(true),
  };
  return { port, useCase: new ProcessPaymentInboxUseCase(port) };
}

describe('payment inbox processing', (): void => {
  it('does no settlement when nothing was claimed', async (): Promise<void> => {
    const { port, useCase } = setup();
    vi.mocked(port.claim).mockResolvedValue(null);
    expect(await useCase.execute('token')).toBe('IDLE');
    expect(port.settle).not.toHaveBeenCalled();
  });
  it.each(['COMPLETED', 'LATE_PAYMENT', 'ALREADY_PROCESSED'] as const)(
    'preserves the authoritative %s outcome',
    async (outcome): Promise<void> => {
      const { port, useCase } = setup();
      vi.mocked(port.settle).mockResolvedValue(outcome);
      expect(await useCase.execute('token')).toBe(outcome);
      expect(port.settle).toHaveBeenCalledWith('event', 'token');
      expect(port.fail).not.toHaveBeenCalled();
    },
  );
  it('records a failed attempt under the same fencing token', async (): Promise<void> => {
    const { port, useCase } = setup();
    vi.mocked(port.settle).mockRejectedValue(new Error('Database unavailable'));
    expect(await useCase.execute('token')).toBe('RETRY_SCHEDULED');
    expect(port.fail).toHaveBeenCalledWith('event', 'token');
  });
  it('never overwrites another worker after losing the lease', async (): Promise<void> => {
    const { port, useCase } = setup();
    vi.mocked(port.settle).mockRejectedValue(new Error('Lease lost'));
    vi.mocked(port.fail).mockResolvedValue(false);
    expect(await useCase.execute('token')).toBe('LEASE_LOST');
  });
  it('propagates failure to persist retry so the runner can report degraded health', async (): Promise<void> => {
    const { port, useCase } = setup();
    vi.mocked(port.settle).mockRejectedValue(new Error('Lost connection'));
    vi.mocked(port.fail).mockRejectedValue(new Error('Retry persistence unavailable'));
    await expect(useCase.execute('token')).rejects.toThrow('Retry persistence unavailable');
  });
  it('does not pretend a failed claim means an empty queue', async (): Promise<void> => {
    const { port, useCase } = setup();
    vi.mocked(port.claim).mockRejectedValue(new Error('Claim unavailable'));
    await expect(useCase.execute('token')).rejects.toThrow('Claim unavailable');
    expect(port.fail).not.toHaveBeenCalled();
  });
});

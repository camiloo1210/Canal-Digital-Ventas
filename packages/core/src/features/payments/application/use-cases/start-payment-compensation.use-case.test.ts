import { describe, it, expect, vi } from 'vitest';
import { StartPaymentCompensationUseCase } from '@/payments/application/use-cases/start-payment-compensation.use-case';
import type { PaymentCompensationCandidate } from '@/payments/application/ports/out/payment-compensation.port';
import { FakePaymentCompensation } from '@/testing/fakes/fake-payment-compensation';

const candidate: PaymentCompensationCandidate = {
  obligationId: 'obligation-1',
  paymentId: 'payment-1',
  tenantId: 'tenant-1',
  remainingCents: 2500,
};

describe('StartPaymentCompensationUseCase', () => {
  it("returns 'IDLE' and creates nothing when nothing is due", async (): Promise<void> => {
    const compensation = new FakePaymentCompensation([]);

    await expect(new StartPaymentCompensationUseCase(compensation).execute()).resolves.toBe('IDLE');

    expect(compensation.created).toEqual([]);
  });

  it("returns 'CREATED' once when due, creating exactly the found candidate", async (): Promise<void> => {
    const compensation = new FakePaymentCompensation([candidate]);

    await expect(new StartPaymentCompensationUseCase(compensation).execute()).resolves.toBe(
      'CREATED',
    );

    expect(compensation.created).toEqual([candidate]);
  });

  it("is idempotent across runs: 'CREATED' then 'IDLE', one compensation in total", async (): Promise<void> => {
    const compensation = new FakePaymentCompensation([candidate]);
    const useCase = new StartPaymentCompensationUseCase(compensation);

    expect(await useCase.execute()).toBe('CREATED');
    expect(await useCase.execute()).toBe('IDLE');

    expect(compensation.created).toHaveLength(1);
  });

  it('handles one candidate per run even when several are due', async (): Promise<void> => {
    const second: PaymentCompensationCandidate = { ...candidate, obligationId: 'obligation-2' };
    const compensation = new FakePaymentCompensation([candidate, second]);
    const useCase = new StartPaymentCompensationUseCase(compensation);

    expect(await useCase.execute()).toBe('CREATED');
    expect(compensation.created).toEqual([candidate]);
    expect(await useCase.execute()).toBe('CREATED');
    expect(compensation.created).toEqual([candidate, second]);
  });

  it('propagates a creation failure rather than reporting CREATED', async (): Promise<void> => {
    const failure = new Error('database unavailable');
    const port = {
      findDue: vi.fn().mockResolvedValue(candidate),
      create: vi.fn().mockRejectedValue(failure),
    };

    await expect(new StartPaymentCompensationUseCase(port).execute()).rejects.toBe(failure);
  });

  it('propagates a lookup failure and creates nothing', async (): Promise<void> => {
    const failure = new Error('database unavailable');
    const port = { findDue: vi.fn().mockRejectedValue(failure), create: vi.fn() };

    await expect(new StartPaymentCompensationUseCase(port).execute()).rejects.toBe(failure);
    expect(port.create).not.toHaveBeenCalled();
  });
});

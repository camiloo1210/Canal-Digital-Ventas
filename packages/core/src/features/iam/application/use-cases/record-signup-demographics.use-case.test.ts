import { describe, expect, it, vi } from 'vitest';
import type { SignupDemographicsPort } from '@/iam/application/ports/out/signup-demographics.port';
import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';
import { RecordSignupDemographicsUseCase } from '@/iam/application/use-cases/record-signup-demographics.use-case';
import { InvalidDemographicBucketException } from '@/iam/domain/exceptions/invalid-demographic-bucket.exception';

const USER = '11111111-1111-4111-8111-111111111111';
const TENANT = '33333333-3333-4333-8333-333333333333';
const TX: TransactionContext = {
  executeNative: <C, R>(callback: (conn: C) => Promise<R>): Promise<R> =>
    callback({} as unknown as C),
};
const transactions: TransactionManagerPort = {
  runInTransaction: <T>(operation: (tx: TransactionContext) => Promise<T>): Promise<T> =>
    operation(TX),
};

function setup(): { port: SignupDemographicsPort; useCase: RecordSignupDemographicsUseCase } {
  const port: SignupDemographicsPort = { record: vi.fn().mockResolvedValue(undefined) };
  return { port, useCase: new RecordSignupDemographicsUseCase(port, transactions) };
}

describe('RecordSignupDemographicsUseCase', () => {
  it('stores nothing and ignores buckets when consent is declined', async () => {
    const { port, useCase } = setup();
    await useCase.execute({
      userId: USER,
      consent: false,
      ageRange: '25_34',
      gender: 'FEMALE',
      province: 'AZUAY',
      tenantId: TENANT,
    });
    expect(port.record).not.toHaveBeenCalled();
  });

  it('records validated buckets and the tenant when consent is given', async () => {
    const { port, useCase } = setup();
    await useCase.execute({
      userId: USER,
      consent: true,
      ageRange: '25_34',
      gender: 'FEMALE',
      province: 'AZUAY',
      tenantId: TENANT,
    });
    expect(port.record).toHaveBeenCalledWith(
      {
        userId: USER,
        consent: true,
        ageRange: '25_34',
        gender: 'FEMALE',
        province: 'AZUAY',
        tenantId: TENANT,
      },
      TX,
    );
  });

  it('records consent without buckets or tenant', async () => {
    const { port, useCase } = setup();
    await useCase.execute({ userId: USER, consent: true });
    expect(port.record).toHaveBeenCalledWith(
      { userId: USER, consent: true, ageRange: null, gender: null, province: null, tenantId: null },
      TX,
    );
  });

  it('rejects buckets outside the fixed lists before touching the port', async () => {
    const { port, useCase } = setup();
    await expect(
      useCase.execute({ userId: USER, consent: true, ageRange: '27' }),
    ).rejects.toBeInstanceOf(InvalidDemographicBucketException);
    expect(port.record).not.toHaveBeenCalled();
  });
});

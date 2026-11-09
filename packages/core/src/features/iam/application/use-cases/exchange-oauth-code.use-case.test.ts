import { beforeEach, describe, expect, it } from 'vitest';
import { ExchangeOAuthCodeUseCase } from '@/iam/application/use-cases/exchange-oauth-code.use-case';
import { AuthGatewayException } from '@/iam/application/exceptions/auth-gateway.exception';
import { FakeAuthGateway } from '@/testing/fakes/fake-auth-gateway';

describe('ExchangeOAuthCodeUseCase', (): void => {
  let gateway: FakeAuthGateway;
  let useCase: ExchangeOAuthCodeUseCase;

  beforeEach((): void => {
    gateway = new FakeAuthGateway();
    gateway.seedOAuthCode('code-1');
    useCase = new ExchangeOAuthCodeUseCase(gateway);
  });

  it('exchanges a valid code once', async (): Promise<void> => {
    await expect(useCase.execute('code-1')).resolves.toBeUndefined();
    expect(gateway.exchangeCalls).toEqual(['code-1']);
  });

  it('fails when the same code is reused', async (): Promise<void> => {
    await useCase.execute('code-1');
    await expect((): Promise<void> => useCase.execute('code-1')).rejects.toThrow(
      AuthGatewayException,
    );
  });

  it.each(['', 'forged-code', 'code-2'])(
    'fails for the invalid code %j',
    async (code): Promise<void> => {
      await expect((): Promise<void> => useCase.execute(code)).rejects.toThrow(
        AuthGatewayException,
      );
    },
  );

  it('does not leak the code in the failure message', async (): Promise<void> => {
    await expect((): Promise<void> => useCase.execute('forged-code')).rejects.not.toThrow(
      /forged-code/,
    );
  });
});

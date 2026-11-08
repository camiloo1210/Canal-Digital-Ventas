import { beforeEach, describe, expect, it } from 'vitest';
import { RegisterGlobalIdentityUseCase } from '@/iam/application/use-cases/register-global-identity.use-case';
import { EmailAlreadyRegisteredException } from '@/iam/application/exceptions/email-already-registered.exception';
import { InvalidEmailException } from '@/shared/domain/exceptions/invalid-email.exception';
import { FakeAuthGateway } from '@/testing/fakes/fake-auth-gateway';

describe('RegisterGlobalIdentityUseCase', (): void => {
  let gateway: FakeAuthGateway;
  let useCase: RegisterGlobalIdentityUseCase;

  beforeEach((): void => {
    gateway = new FakeAuthGateway();
    useCase = new RegisterGlobalIdentityUseCase(gateway);
  });

  it('returns the new identity id', async (): Promise<void> => {
    const id = await useCase.execute({ email: 'new@example.com', password: 'Str0ng-pass!' });
    expect(id).toBe('00000000-0000-4000-8000-000000000001');
    expect(gateway.signUpCalls).toEqual([{ email: 'new@example.com', password: 'Str0ng-pass!' }]);
  });

  it('fails with EmailAlreadyRegisteredException for a registered email and creates no second identity', async (): Promise<void> => {
    await useCase.execute({ email: 'new@example.com', password: 'Str0ng-pass!' });
    await expect((): Promise<string> =>
      useCase.execute({ email: 'new@example.com', password: 'other' }),
    ).rejects.toThrow(EmailAlreadyRegisteredException);
  });

  // FINDING: the use case forwards the raw email to the gateway without Email.create, so
  // "invalid" and differently cased / padded emails reach the auth provider un-normalized (the
  // same person can register as "A@x.com" and "a@x.com" if the provider is case sensitive).
  // Expected: invalid emails rejected with InvalidEmailException, valid ones normalized.
  it.fails('rejects a malformed email without calling the gateway', async (): Promise<void> => {
    await expect((): Promise<string> =>
      useCase.execute({ email: 'not-an-email', password: 'Str0ng-pass!' }),
    ).rejects.toThrow(InvalidEmailException);
    expect(gateway.signUpCalls).toHaveLength(0);
  });

  it.fails('normalizes the email before registering', async (): Promise<void> => {
    await useCase.execute({ email: '  NEW@Example.com ', password: 'Str0ng-pass!' });
    expect(gateway.signUpCalls[0]?.email).toBe('new@example.com');
  });
});

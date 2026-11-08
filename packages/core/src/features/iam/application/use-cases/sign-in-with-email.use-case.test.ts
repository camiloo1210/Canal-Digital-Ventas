import { beforeEach, describe, expect, it } from 'vitest';
import { SignInWithEmailUseCase } from '@/iam/application/use-cases/sign-in-with-email.use-case';
import { InvalidCredentialsException } from '@/iam/domain/exceptions/invalid-credentials.exception';
import { InvalidEmailException } from '@/shared/domain/exceptions/invalid-email.exception';
import { FakeAuthGateway } from '@/testing/fakes/fake-auth-gateway';

const USER_ID = '11111111-1111-4111-8111-111111111111';

async function failureOf(run: () => Promise<unknown>): Promise<Error> {
  try {
    await run();
  } catch (error: unknown) {
    if (error instanceof Error) return error;
  }
  throw new Error('expected a failure');
}

describe('SignInWithEmailUseCase', (): void => {
  let gateway: FakeAuthGateway;
  let useCase: SignInWithEmailUseCase;

  beforeEach((): void => {
    gateway = new FakeAuthGateway();
    gateway.seedAccount('ana@example.com', 'correct-password', USER_ID);
    useCase = new SignInWithEmailUseCase(gateway);
  });

  it('returns the user id for valid credentials', async (): Promise<void> => {
    await expect(
      useCase.execute({ email: 'ana@example.com', password: 'correct-password' }),
    ).resolves.toEqual({ userId: USER_ID });
  });

  it('normalizes the email (trim and lowercase) before calling the gateway', async (): Promise<void> => {
    await useCase.execute({ email: '  ANA@Example.com ', password: 'correct-password' });
    expect(gateway.signInCalls).toEqual([
      { email: 'ana@example.com', password: 'correct-password' },
    ]);
  });

  it('fails with the generic credentials error on a wrong password', async (): Promise<void> => {
    await expect((): Promise<unknown> =>
      useCase.execute({ email: 'ana@example.com', password: 'nope' }),
    ).rejects.toThrow(InvalidCredentialsException);
  });

  it('does not reveal whether the email exists: unknown email and wrong password fail identically', async (): Promise<void> => {
    const wrongPassword = await failureOf((): Promise<unknown> =>
      useCase.execute({ email: 'ana@example.com', password: 'nope' }),
    );
    const unknownEmail = await failureOf((): Promise<unknown> =>
      useCase.execute({ email: 'ghost@example.com', password: 'nope' }),
    );
    expect(unknownEmail).toBeInstanceOf(InvalidCredentialsException);
    expect(unknownEmail.constructor).toBe(wrongPassword.constructor);
    expect(unknownEmail.message).toBe(wrongPassword.message);
    expect(unknownEmail.message).not.toContain('ghost@example.com');
    expect(unknownEmail.message.toLowerCase()).not.toMatch(/not found|exist|unknown|no user/);
  });

  it.each(['', '   ', 'not-an-email', 'a@b'])(
    'rejects the malformed email %j without calling the gateway',
    async (email): Promise<void> => {
      await expect((): Promise<unknown> =>
        useCase.execute({ email, password: 'x' }),
      ).rejects.toThrow(InvalidEmailException);
      expect(gateway.signInCalls).toHaveLength(0);
    },
  );

  it('rejects a gateway user id that is not a UUID', async (): Promise<void> => {
    gateway.seedAccount('bad@example.com', 'pw', 'not-a-uuid');
    await expect((): Promise<unknown> =>
      useCase.execute({ email: 'bad@example.com', password: 'pw' }),
    ).rejects.toThrow();
  });
});

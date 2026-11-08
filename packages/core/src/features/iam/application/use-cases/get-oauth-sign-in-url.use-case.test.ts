import { beforeEach, describe, expect, it } from 'vitest';
import { GetOAuthSignInUrlUseCase } from '@/iam/application/use-cases/get-oauth-sign-in-url.use-case';
import { InvalidProviderException } from '@/iam/domain/exceptions/invalid-provider.exception';
import { FakeAuthGateway } from '@/testing/fakes/fake-auth-gateway';

describe('GetOAuthSignInUrlUseCase', (): void => {
  let gateway: FakeAuthGateway;
  let useCase: GetOAuthSignInUrlUseCase;

  beforeEach((): void => {
    gateway = new FakeAuthGateway();
    useCase = new GetOAuthSignInUrlUseCase(gateway);
  });

  it.each(['google', 'github', 'azure'])(
    'returns the gateway url for provider %s and forwards redirectTo',
    async (provider): Promise<void> => {
      const url = await useCase.execute({ provider, redirectTo: 'https://shop.test/callback' });
      expect(url).toBe(
        `https://auth.test/oauth/${provider}?redirect_to=${encodeURIComponent('https://shop.test/callback')}`,
      );
      expect(gateway.oauthUrlCalls).toEqual([
        { provider, redirectTo: 'https://shop.test/callback' },
      ]);
    },
  );

  it.each(['facebook', 'GOOGLE', '', ' google', '__proto__'])(
    'rejects the provider %j without calling the gateway',
    async (provider): Promise<void> => {
      await expect((): Promise<string> =>
        useCase.execute({ provider, redirectTo: 'https://shop.test/cb' }),
      ).rejects.toThrow(InvalidProviderException);
      expect(gateway.oauthUrlCalls).toHaveLength(0);
    },
  );

  // FINDING: redirectTo is forwarded unvalidated (no allow-list), so an attacker-controlled
  // absolute URL becomes the post-login redirect (open redirect) unless the adapter filters it.
  it.fails('rejects a redirectTo pointing at a foreign origin', async (): Promise<void> => {
    await expect((): Promise<string> =>
      useCase.execute({ provider: 'google', redirectTo: 'https://evil.example/steal' }),
    ).rejects.toThrow();
    expect(gateway.oauthUrlCalls).toHaveLength(0);
  });
});

import type { AuthPort } from '@/iam/application/ports/out/auth.port';
import { InvalidCredentialsException } from '@/iam/domain/exceptions/invalid-credentials.exception';
import { EmailAlreadyRegisteredException } from '@/iam/application/exceptions/email-already-registered.exception';
import { AuthGatewayException } from '@/iam/application/exceptions/auth-gateway.exception';

interface Account {
  userId: string;
  password: string;
}

/**
 * Deterministic AuthPort. Accounts are keyed by the exact email string received.
 * Unknown email and wrong password fail identically (generic InvalidCredentialsException),
 * like a correct adapter must. OAuth codes are single use.
 */
export class FakeAuthGateway implements AuthPort {
  private readonly accounts = new Map<string, Account>();
  private readonly validCodes = new Set<string>();
  private readonly usedCodes = new Set<string>();
  private nextSignUp = 1;
  public readonly signInCalls: { email: string; password: string }[] = [];
  public readonly signUpCalls: { email: string; password: string }[] = [];
  public readonly oauthUrlCalls: { provider: string; redirectTo: string }[] = [];
  public readonly exchangeCalls: string[] = [];

  public seedAccount(email: string, password: string, userId: string): void {
    this.accounts.set(email, { userId, password });
  }

  /** Registers a code the provider would accept exactly once. */
  public seedOAuthCode(code: string): void {
    this.validCodes.add(code);
  }

  async signInWithEmail(email: string, password: string): Promise<{ userId: string }> {
    this.signInCalls.push({ email, password });
    const account = this.accounts.get(email);
    if (!account || account.password !== password) throw new InvalidCredentialsException();
    return { userId: account.userId };
  }

  async getOAuthSignInUrl(provider: string, redirectTo: string): Promise<string> {
    this.oauthUrlCalls.push({ provider, redirectTo });
    return `https://auth.test/oauth/${provider}?redirect_to=${encodeURIComponent(redirectTo)}`;
  }

  async exchangeOAuthCode(code: string): Promise<void> {
    this.exchangeCalls.push(code);
    if (!this.validCodes.has(code) || this.usedCodes.has(code)) {
      throw new AuthGatewayException('OAuth code exchange failed');
    }
    this.usedCodes.add(code);
  }

  async signUpWithEmail(email: string, password: string): Promise<string> {
    return (await this.signUpWithEmailDetailed(email, password)).userId;
  }

  async signUpWithEmailDetailed(
    email: string,
    password: string,
  ): Promise<{ userId: string; hasSession: boolean }> {
    this.signUpCalls.push({ email, password });
    if (this.accounts.has(email)) throw new EmailAlreadyRegisteredException();
    const userId = `00000000-0000-4000-8000-${String(this.nextSignUp++).padStart(12, '0')}`;
    this.accounts.set(email, { userId, password });
    return { userId, hasSession: true };
  }
}

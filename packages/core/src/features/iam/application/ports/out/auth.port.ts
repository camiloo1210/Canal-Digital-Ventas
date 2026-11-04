export interface AuthPort {
  signInWithEmail(email: string, password: string): Promise<{ userId: string }>;

  getOAuthSignInUrl(provider: string, redirectTo: string): Promise<string>;

  exchangeOAuthCode(code: string): Promise<void>;

  signUpWithEmail(email: string, password: string): Promise<string>;

  /** Like signUpWithEmail, but also reports whether the sign up produced a signed-in session. */
  signUpWithEmailDetailed(
    email: string,
    password: string,
  ): Promise<{ userId: string; hasSession: boolean }>;
}

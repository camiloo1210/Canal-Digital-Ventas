export interface AuthPort {
  signInWithEmail(email: string, password: string): Promise<{ userId: string; tenantId: string }>;

  getOAuthSignInUrl(provider: string, redirectTo: string): Promise<string>;
}

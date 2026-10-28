const REF = /^KIVI_CONNECTION_TOKEN_[A-Z0-9_]{1,64}$/;
const TOKEN = /^kc_[A-Za-z0-9_-]{43}$/;

/** Legacy: resolves stored references against the worker's environment (secret store injection). */
export class EnvKiviSecretResolver {
  public constructor(private readonly env: Record<string, string | undefined>) {}

  public resolve(secretRef: string): string | null {
    if (!REF.test(secretRef)) return null;
    const value = this.env[secretRef];
    return value !== undefined && TOKEN.test(value) ? value : null;
  }
}

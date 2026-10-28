import { InvalidKiviConnectionException } from '@/kivi/domain/exceptions/invalid-kivi-connection.exception';

const PATTERN = /^KIVI_CONNECTION_TOKEN_[A-Z0-9_]{1,64}$/;

/**
 * Name of the server environment variable holding the Kivi connection token (`kc_...`).
 * Only the reference is persisted; the credential itself never touches the database.
 */
export class KiviSecretRef {
  private constructor(private readonly value: string) {}

  public static from(raw: string): KiviSecretRef {
    if (!PATTERN.test(raw)) {
      throw new InvalidKiviConnectionException(
        'Secret reference must be an environment variable named KIVI_CONNECTION_TOKEN_*.',
      );
    }
    return new KiviSecretRef(raw);
  }

  public getValue(): string {
    return this.value;
  }

  public toString(): string {
    return '[kivi-secret-ref]';
  }
}

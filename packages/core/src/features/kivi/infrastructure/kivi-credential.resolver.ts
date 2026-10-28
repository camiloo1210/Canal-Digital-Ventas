import type { KiviSecretResolverPort } from '@/kivi/application/ports/out/kivi-secret-resolver.port';
import type { KiviTokenCipherPort } from '@/kivi/application/ports/out/kivi-token-cipher.port';
import type { KiviConnection } from '@/kivi/domain/entities/kivi-connection.entity';
import type { EnvKiviSecretResolver } from '@/kivi/infrastructure/env-kivi-secret.resolver';

/**
 * Paired connections: decrypt the stored token (bound to the store). Legacy connections: the
 * worker env var named by secret_ref. A ciphertext that fails to decrypt yields no credential;
 * it never silently falls back to a different source.
 */
export class KiviCredentialResolver implements KiviSecretResolverPort {
  public constructor(
    private readonly cipher: KiviTokenCipherPort,
    private readonly legacy: EnvKiviSecretResolver,
  ) {}

  public resolve(connection: KiviConnection): string | null {
    const encrypted = connection.getEncryptedToken();
    if (encrypted) {
      try {
        return this.cipher.decrypt(encrypted, connection.getTenantId());
      } catch {
        return null;
      }
    }
    const ref = connection.getSecretRef();
    return ref ? this.legacy.resolve(ref.getValue()) : null;
  }
}

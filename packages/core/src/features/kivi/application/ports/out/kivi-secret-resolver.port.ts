import type { KiviConnection } from '@/kivi/domain/entities/kivi-connection.entity';

export interface KiviSecretResolverPort {
  /**
   * Returns the connection token (decrypted paired ciphertext first, legacy env reference as
   * fallback), or null when no usable credential is available.
   */
  resolve(connection: KiviConnection): string | null;
}

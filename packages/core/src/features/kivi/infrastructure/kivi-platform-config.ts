import { KiviBaseUrl, type KiviBaseUrlOptions } from '@/kivi/domain/value-objects/kivi-base-url.vo';
import { InvalidKiviConnectionException } from '@/kivi/domain/exceptions/invalid-kivi-connection.exception';
import { loadKiviTokenCipher } from '@/kivi/infrastructure/aes-gcm-kivi-token.cipher';
import type { AesGcmKiviTokenCipher } from '@/kivi/infrastructure/aes-gcm-kivi-token.cipher';
import { KiviConfigurationException } from '@/kivi/infrastructure/kivi-configuration.exception';

export interface KiviPlatformConfig {
  /** Kivi origin, configured once by the operator for every store. */
  baseUrl: KiviBaseUrl;
  urlOptions: KiviBaseUrlOptions;
  cipher: AesGcmKiviTokenCipher;
}

/**
 * Operator-level configuration (not per store): KIVI_BASE_URL and KIVI_TOKEN_ENCRYPTION_KEY.
 * Fails closed with errors that name the variable and never echo its value.
 */
export function loadKiviPlatformConfig(
  env: Record<string, string | undefined>,
): KiviPlatformConfig {
  const allowLocalDevelopment = env.KIVI_ALLOW_LOCAL_DEVELOPMENT === 'true';
  if (allowLocalDevelopment && env.NODE_ENV === 'production') {
    throw new KiviConfigurationException('KIVI_ALLOW_LOCAL_DEVELOPMENT is forbidden in production');
  }
  const urlOptions = { allowLocalDevelopment };
  const raw = env.KIVI_BASE_URL?.trim();
  if (!raw) throw new KiviConfigurationException('KIVI_BASE_URL is not configured');
  let baseUrl: KiviBaseUrl;
  try {
    baseUrl = KiviBaseUrl.from(raw, urlOptions);
  } catch (error: unknown) {
    if (error instanceof InvalidKiviConnectionException) {
      throw new KiviConfigurationException('KIVI_BASE_URL is not a safe public https origin');
    }
    throw error;
  }
  return { baseUrl, urlOptions, cipher: loadKiviTokenCipher(env) };
}

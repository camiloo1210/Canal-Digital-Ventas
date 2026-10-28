import { describe, expect, it } from 'vitest';
import {
  loadKiviPlatformConfig,
  type KiviPlatformConfig,
} from '@/kivi/infrastructure/kivi-platform-config';
import { KiviConfigurationException } from '@/kivi/infrastructure/kivi-configuration.exception';

const KEY = Buffer.alloc(32, 9).toString('base64');
const base = { KIVI_BASE_URL: 'https://api.kivi.example', KIVI_TOKEN_ENCRYPTION_KEY: KEY };

describe('loadKiviPlatformConfig', (): void => {
  it('loads the operator-level Kivi origin and key', (): void => {
    const config = loadKiviPlatformConfig(base);
    expect(config.baseUrl.getValue()).toBe('https://api.kivi.example');
    expect(config.urlOptions).toEqual({ allowLocalDevelopment: false });
    const encrypted = config.cipher.encrypt('kc_x', 'tenant');
    expect(config.cipher.decrypt(encrypted, 'tenant')).toBe('kc_x');
  });

  it('fails closed, naming the variable, when either value is missing', (): void => {
    expect((): KiviPlatformConfig =>
      loadKiviPlatformConfig({ KIVI_TOKEN_ENCRYPTION_KEY: KEY }),
    ).toThrow(/KIVI_BASE_URL/);
    expect((): KiviPlatformConfig =>
      loadKiviPlatformConfig({ KIVI_BASE_URL: base.KIVI_BASE_URL }),
    ).toThrow(/KIVI_TOKEN_ENCRYPTION_KEY/);
    expect((): KiviPlatformConfig => loadKiviPlatformConfig({})).toThrow(
      KiviConfigurationException,
    );
  });

  it('applies the SSRF guard to KIVI_BASE_URL without echoing it', (): void => {
    for (const url of ['http://api.kivi.example', 'https://169.254.169.254', 'https://x.local/p']) {
      try {
        loadKiviPlatformConfig({ ...base, KIVI_BASE_URL: url });
        expect.unreachable();
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(KiviConfigurationException);
        expect((error as Error).message).toMatch(/KIVI_BASE_URL/);
        expect((error as Error).message).not.toContain(url);
      }
    }
  });

  it('allows loopback only with the dev flag and never in production', (): void => {
    const local = { ...base, KIVI_BASE_URL: 'http://localhost:8000' };
    expect((): KiviPlatformConfig => loadKiviPlatformConfig(local)).toThrow(
      KiviConfigurationException,
    );
    const dev = loadKiviPlatformConfig({
      ...local,
      KIVI_ALLOW_LOCAL_DEVELOPMENT: 'true',
      NODE_ENV: 'development',
    });
    expect(dev.urlOptions.allowLocalDevelopment).toBe(true);
    expect((): KiviPlatformConfig =>
      loadKiviPlatformConfig({
        ...local,
        KIVI_ALLOW_LOCAL_DEVELOPMENT: 'true',
        NODE_ENV: 'production',
      }),
    ).toThrow(KiviConfigurationException);
  });
});

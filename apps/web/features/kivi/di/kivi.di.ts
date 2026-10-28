import 'server-only';
import { sql } from '@/lib/postgres/server';
import {
  HttpKiviPairingGateway,
  KiviPairingException,
  PairStoreWithKiviUseCase,
  PostgresKiviConnectionReadRepository,
  PostgresKiviConnectionRepository,
  PostgresTransactionManagerAdapter,
  RequestKiviSyncUseCase,
  UnlinkStoreFromKiviUseCase,
  loadKiviPlatformConfig,
  type KiviConnectionReadRepositoryPort,
  type UnlinkStoreFromKiviDependencies,
} from '@canaldigital/packages/core';

/**
 * Loopback Kivi targets are a development convenience. The platform config rejects the flag in
 * production; reading rows must keep working even if the operator left it set, so the row
 * policy stays conservative.
 */
function rowUrlOptions(): { allowLocalDevelopment: boolean } {
  return {
    allowLocalDevelopment:
      process.env.KIVI_ALLOW_LOCAL_DEVELOPMENT === 'true' && process.env.NODE_ENV !== 'production',
  };
}

export function getKiviConnectionReadRepository(): KiviConnectionReadRepositoryPort {
  return new PostgresKiviConnectionReadRepository(sql);
}

/** Throws KiviConfigurationException (fail closed) when KIVI_BASE_URL or the key are missing. */
export function getPairStoreWithKiviUseCase(): PairStoreWithKiviUseCase {
  const platform = loadKiviPlatformConfig(process.env);
  return new PairStoreWithKiviUseCase(
    new PostgresKiviConnectionRepository(platform.urlOptions),
    new PostgresTransactionManagerAdapter(sql),
    new HttpKiviPairingGateway({ baseUrl: platform.baseUrl, urlOptions: platform.urlOptions }),
    platform.cipher,
    platform.baseUrl,
  );
}

/**
 * Disconnecting must work even when the platform configuration is incomplete: in that case the
 * remote revoke is skipped (it is best effort anyway) and the local unlink still wipes the token.
 */
function revocationDependencies(): UnlinkStoreFromKiviDependencies {
  const logger = { warn: (message: string): void => console.warn(`[Kivi] ${message}`) };
  try {
    const platform = loadKiviPlatformConfig(process.env);
    return {
      gateway: new HttpKiviPairingGateway({
        baseUrl: platform.baseUrl,
        urlOptions: platform.urlOptions,
      }),
      cipher: platform.cipher,
      logger,
    };
  } catch {
    return {
      gateway: {
        exchange: (): Promise<never> => Promise.reject(new KiviPairingException('unavailable')),
        revokeSelf: (): Promise<never> => Promise.reject(new KiviPairingException('unavailable')),
      },
      cipher: {
        encrypt: (): never => {
          throw new KiviPairingException('unavailable');
        },
        decrypt: (): never => {
          throw new KiviPairingException('unavailable');
        },
      },
      logger,
    };
  }
}

export function getUnlinkStoreFromKiviUseCase(): UnlinkStoreFromKiviUseCase {
  return new UnlinkStoreFromKiviUseCase(
    new PostgresKiviConnectionRepository(rowUrlOptions()),
    new PostgresTransactionManagerAdapter(sql),
    revocationDependencies(),
  );
}

export function getRequestKiviSyncUseCase(): RequestKiviSyncUseCase {
  return new RequestKiviSyncUseCase(
    new PostgresKiviConnectionRepository(rowUrlOptions()),
    new PostgresTransactionManagerAdapter(sql),
  );
}

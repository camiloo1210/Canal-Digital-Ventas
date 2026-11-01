import 'server-only';
import { sql } from '@/lib/postgres/server';
import {
  ConfigureKiviWhatsAppUseCase,
  ConfigureKiviNotificationsUseCase,
  KiviMessagingReadRepository,
  HttpKiviNotificationSettingsGateway,
  type KiviMessagingReadPort,
  PostgresKiviStoreWidgetReadRepository,
  type KiviStoreWidgetReadPort,
  HttpKiviWhatsAppGateway,
  KiviCredentialResolver,
  EnvKiviSecretResolver,
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

export function getKiviStoreWidgetReadRepository(): KiviStoreWidgetReadPort {
  const platform = loadKiviPlatformConfig(process.env);
  return new PostgresKiviStoreWidgetReadRepository(
    sql,
    platform.cipher,
    new HttpKiviNotificationSettingsGateway({ urlOptions: platform.urlOptions, timeoutMs: 1500 }),
  );
}

export function getConfigureKiviWhatsAppUseCase(): ConfigureKiviWhatsAppUseCase {
  const platform = loadKiviPlatformConfig(process.env);
  return new ConfigureKiviWhatsAppUseCase(
    new PostgresKiviConnectionRepository(platform.urlOptions),
    new PostgresTransactionManagerAdapter(sql),
    new KiviCredentialResolver(platform.cipher, new EnvKiviSecretResolver(process.env)),
    new HttpKiviWhatsAppGateway({ urlOptions: platform.urlOptions }),
  );
}

export function getConfigureKiviNotificationsUseCase(): ConfigureKiviNotificationsUseCase {
  const platform = loadKiviPlatformConfig(process.env);
  return new ConfigureKiviNotificationsUseCase(
    new PostgresKiviConnectionRepository(platform.urlOptions),
    new PostgresTransactionManagerAdapter(sql),
    new KiviCredentialResolver(platform.cipher, new EnvKiviSecretResolver(process.env)),
    new HttpKiviNotificationSettingsGateway({ urlOptions: platform.urlOptions }),
  );
}

export function getKiviMessagingReadRepository(): KiviMessagingReadPort {
  const platform = loadKiviPlatformConfig(process.env);
  return new KiviMessagingReadRepository(
    new PostgresKiviConnectionRepository(platform.urlOptions),
    new PostgresTransactionManagerAdapter(sql),
    new KiviCredentialResolver(platform.cipher, new EnvKiviSecretResolver(process.env)),
    new HttpKiviNotificationSettingsGateway({ urlOptions: platform.urlOptions }),
  );
}

// Keep local unlinking available when platform configuration is incomplete.
function rowUrlOptions(): { allowLocalDevelopment: boolean } {
  return {
    allowLocalDevelopment:
      process.env.KIVI_ALLOW_LOCAL_DEVELOPMENT === 'true' && process.env.NODE_ENV !== 'production',
  };
}

export function getKiviConnectionReadRepository(): KiviConnectionReadRepositoryPort {
  return new PostgresKiviConnectionReadRepository(sql);
}

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

// Remote revocation is best effort; local unlinking must still erase the token.
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

import { describe, expect, it, vi } from 'vitest';
import { cookies } from 'next/headers';
import { createTranslator } from 'next-intl';
import type { GetRequestConfigParams, RequestConfig } from 'next-intl/server';
import requestConfig from '@/i18n/request';

vi.mock('next/headers', (): object => ({ cookies: vi.fn() }));
vi.mock('next-intl/server', (): object => ({
  getRequestConfig: (
    factory: (params: GetRequestConfigParams) => Promise<RequestConfig>,
  ): typeof factory => factory,
}));

describe('request translation catalogs', (): void => {
  it.each(['es', 'en'])(
    'loads every store search and slug message in %s',
    async (locale: string): Promise<void> => {
      vi.mocked(cookies).mockResolvedValue({
        get: (): { value: string } => ({ value: locale }),
      } as unknown as Awaited<ReturnType<typeof cookies>>);
      const config = await requestConfig({ requestLocale: Promise.resolve(undefined) });
      expect(config.locale).toBe(locale);
      const translate = createTranslator({
        locale: config.locale,
        messages: config.messages ?? undefined,
        onError: (error): never => {
          throw error;
        },
      });
      for (const key of [
        'search_stores_label',
        'search_stores_placeholder',
        'search_stores_button',
        'clear_store_search',
        'no_matching_stores',
        'store_results',
        'previous_stores',
        'next_stores',
        'store_pagination',
      ]) {
        expect(translate(`BuyerDashboard.${key}`, { count: 2 })).not.toContain('BuyerDashboard.');
      }
      for (const key of ['slug', 'slugHelp', 'slugTaken', 'slugChangeNotice']) {
        expect(translate(`StoreSettings.${key}`)).not.toContain('StoreSettings.');
      }
      for (const key of [
        'brand',
        'code',
        'title',
        'description',
        'backHome',
        'hint',
        'backDashboard',
        'dashboardHint',
      ]) {
        expect(translate(`NotFound.${key}`)).not.toContain('NotFound.');
      }
    },
  );

  it.each([undefined, '', 'fr', '../../invalid'])(
    'uses Spanish for an unsupported locale cookie %s',
    async (locale: string | undefined): Promise<void> => {
      vi.mocked(cookies).mockResolvedValue({
        get: (): { value: string } | undefined =>
          locale === undefined ? undefined : { value: locale },
      } as unknown as Awaited<ReturnType<typeof cookies>>);
      const config = await requestConfig({ requestLocale: Promise.resolve(undefined) });
      expect(config.locale).toBe('es');
      const translate = createTranslator({
        locale: config.locale,
        messages: config.messages ?? undefined,
      });
      expect(translate('BuyerDashboard.search_stores_label')).toBe('Buscar tiendas');
    },
  );
});

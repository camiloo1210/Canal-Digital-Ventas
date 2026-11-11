import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import es from '@/messages/es.json';
import en from '@/messages/en.json';
import { WholesaleAccount } from '@/features/users/components/wholesale-account';

vi.mock('@/features/users/actions/wholesale.actions', (): object => ({
  setWholesaleAction: vi.fn(),
}));

describe('WholesaleAccount', (): void => {
  it.each(['es', 'en'] as const)(
    'shows the current status and reversible action in %s',
    (locale: 'es' | 'en'): void => {
      const messages = locale === 'es' ? es : en;
      const render = (enabled: boolean): string =>
        renderToStaticMarkup(
          <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
            <WholesaleAccount enabled={enabled} />
          </NextIntlClientProvider>,
        );
      expect(render(false)).toContain(messages.WholesaleAccount.enable);
      expect(render(false)).toContain(messages.WholesaleAccount.description.replace("'", '&#x27;'));
      expect(render(true)).toContain(messages.WholesaleAccount.disable);
      expect(render(true)).toContain(messages.WholesaleAccount.active);
    },
  );
});

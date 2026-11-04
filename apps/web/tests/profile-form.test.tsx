import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import es from '@/messages/es.json';
import en from '@/messages/en.json';
import { ProfileForm } from '@/features/users/components/profile-form';

vi.mock('@/features/users/actions/profile.actions', (): object => ({
  updateOwnProfileAction: vi.fn(),
}));

function render(locale: 'es' | 'en', consent: boolean): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'es' ? es : en} timeZone="UTC">
      <ProfileForm
        initial={{ firstName: 'Ana', lastName: 'Pérez', email: 'ana@example.com', consent }}
      />
    </NextIntlClientProvider>,
  );
}

describe('ProfileForm', (): void => {
  it.each(['es', 'en'] as const)(
    'starts clean: save and discard disabled, up to date, email locked (%s)',
    (locale: 'es' | 'en'): void => {
      const messages = locale === 'es' ? es : en;
      const html = render(locale, false);
      expect(html).toContain(messages.Profile.upToDate);
      expect(html).not.toContain(messages.Profile.unsaved);
      const submit = html.match(/<button[^>]*type="submit"[^>]*>/)?.[0] ?? '';
      expect(submit).toContain('disabled');
      expect(html.match(/<input[^>]*id="profile-email"[^>]*>/)?.[0]).toMatch(/readOnly|readonly/i);
      expect(html.match(/<input[^>]*id="profile-email"[^>]*>/)?.[0]).toContain('disabled');
    },
  );

  it('keeps names editable and submits the consent only as an explicit opt-in', (): void => {
    const html = render('es', false);
    expect(html.match(/<input[^>]*name="firstName"[^>]*>/)?.[0]).toContain('value="Ana"');
    expect(html.match(/<input[^>]*name="lastName"[^>]*>/)?.[0]).toContain('value="Pérez"');
    expect(html).toContain(es.Profile.consentLabel);
  });

  it('explains what is and is not shared, in both languages', (): void => {
    for (const [html, messages] of [
      [render('es', true), es],
      [render('en', true), en],
    ] as const) {
      expect(html).toContain(messages.Profile.sections.privacy.sharedTitle);
      expect(html).toContain(messages.Profile.sections.privacy.neverTitle);
      expect(html).toContain(messages.Profile.sections.privacy.never.link);
    }
  });
});

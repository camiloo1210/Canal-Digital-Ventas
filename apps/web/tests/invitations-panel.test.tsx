import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import es from '@/messages/es.json';
import en from '@/messages/en.json';
import { InvitationsPanel } from '@/features/users/components/invitations-panel';

vi.mock('@/features/users/actions/invitations.actions', (): object => ({
  createInvitationAction: vi.fn(),
  revokeInvitationAction: vi.fn(),
}));

function render(adminAuthAvailable: boolean, locale: 'es' | 'en' = 'es'): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'es' ? es : en} timeZone="UTC">
      <InvitationsPanel
        roles={[
          {
            id: crypto.randomUUID(),
            name: 'Cajero',
            permissions: ['orders.read'],
            memberCount: 0,
            isSystem: false,
            createdAt: '2026-11-03T00:00:00.000Z',
          },
        ]}
        invitations={[]}
        adminAuthAvailable={adminAuthAvailable}
      />
    </NextIntlClientProvider>,
  );
}

function generatedRadio(html: string): string {
  return html.match(/<input[^>]*value="GENERATED_EMAIL"[^>]*>/)?.[0] ?? '';
}

describe('InvitationsPanel generated email availability', (): void => {
  it('offers the generated email option without a warning when the service role key exists', (): void => {
    const html = render(true);
    expect(generatedRadio(html)).not.toContain('disabled');
    expect(generatedRadio(html)).toContain('checked');
    expect(html).not.toContain(es.Users.invitations.accountMode.adminUnavailableWarning);
  });

  it.each(['es', 'en'] as const)(
    'warns the owner and disables the generated email option when the key is missing (%s)',
    (locale: 'es' | 'en'): void => {
      const html = render(false, locale);
      const messages = locale === 'es' ? es : en;
      expect(html).toContain(messages.Users.invitations.accountMode.adminUnavailableWarning);
      expect(generatedRadio(html)).toContain('disabled');
      expect(generatedRadio(html)).not.toContain('checked');
      expect(html.match(/<input[^>]*value="REAL_EMAIL"[^>]*>/)?.[0]).toContain('checked');
    },
  );
});

import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { KiviDeliveriesPanel } from '@/features/kivi/components/kivi-deliveries-panel';
import en from '@/messages/en.json';

vi.mock('next/navigation', (): object => ({ useRouter: (): object => ({ refresh: vi.fn() }) }));

describe('notification receipt timestamps', (): void => {
  it('uses the store dashboard timezone even when the server provider defaults to UTC', (): void => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider
        locale="en"
        messages={{ KiviMessaging: en.KiviMessaging }}
        timeZone="UTC"
      >
        <KiviDeliveriesPanel
          deliveries={[
            {
              eventId: '11111111-1111-4111-8111-111111111111',
              channel: 'whatsapp',
              status: 'sent',
              updatedAt: '2026-10-30T12:00:00Z',
            },
          ]}
        />
      </NextIntlClientProvider>,
    );
    expect(html).toContain('7:00');
    expect(html).not.toContain('12:00 PM');
    expect(html).toContain('dateTime="2026-10-30T12:00:00Z"');
  });
});

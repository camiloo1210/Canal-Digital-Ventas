import { describe, expect, it, vi } from 'vitest';
import { HttpKiviWhatsAppGateway } from '@/kivi/infrastructure/http-kivi-whatsapp.gateway';
import { HttpKiviOrderNotificationGateway } from '@/kivi/infrastructure/http-kivi-order-notification.gateway';
import { HttpKiviNotificationSettingsGateway } from '@/kivi/infrastructure/http-kivi-notification-settings.gateway';

const target = {
  baseUrl: 'https://api.kivi.example',
  connectionId: '22222222-2222-4222-8222-222222222222',
  token: 'kc_' + 'A'.repeat(43),
};
const event = {
  messageId: crypto.randomUUID(),
  tenantId: crypto.randomUUID(),
  aggregateId: crypto.randomUUID(),
  aggregateType: 'Order',
  eventType: 'OrderShippedEvent',
  occurredAt: new Date().toISOString(),
  payload: {},
};
const source = { target, phone: '+593999999999', orderNumber: 'ORD-1' };

function options(
  body: unknown,
  status: number = 200,
): { fetch: typeof fetch; resolveAddresses: () => Promise<string[]> } {
  return {
    fetch: vi.fn<typeof fetch>().mockResolvedValue(Response.json(body, { status })),
    resolveAddresses: async (): Promise<string[]> => ['93.184.216.34'],
  };
}

describe('Kivi messaging HTTP contracts', (): void => {
  it('allowlists delivery summaries and discards sensitive remote extras', async (): Promise<void> => {
    const opts = options([
      {
        event_id: event.messageId,
        channel: 'whatsapp',
        status: 'failed',
        updated_at: '2026-10-30T10:00:00Z',
        phone: 'private',
        token: 'secret',
      },
    ]);
    const result = await new HttpKiviNotificationSettingsGateway(opts).readDeliveries(target);
    expect(result).toEqual([
      {
        eventId: event.messageId,
        channel: 'whatsapp',
        status: 'failed',
        updatedAt: '2026-10-30T10:00:00Z',
      },
    ]);
  });
  it.each([
    [{ event_id: event.messageId, channel: 'email', status: 'sent', updated_at: event.occurredAt }],
    [
      {
        event_id: event.messageId,
        channel: 'whatsapp',
        status: 'secret-error',
        updated_at: event.occurredAt,
      },
    ],
    [{ event_id: event.messageId, channel: 'whatsapp', status: 'sent', updated_at: 'invalid' }],
    Array.from({ length: 11 }, (): object => ({
      event_id: event.messageId,
      channel: 'whatsapp',
      status: 'sent',
      updated_at: event.occurredAt,
    })),
  ])('rejects malformed or unbounded receipt summaries', async (body: unknown): Promise<void> => {
    await expect(
      new HttpKiviNotificationSettingsGateway(options(body)).readDeliveries(target),
    ).rejects.toMatchObject({ failure: 'transient' });
  });
  it('exposes only non-secret identity of the connected WhatsApp number', async (): Promise<void> => {
    const result = await new HttpKiviNotificationSettingsGateway(
      options({
        channel: 'whatsapp',
        connected: true,
        external_id: '1234567890',
        name: '+57 300 000 0000',
        access_token: 'secret',
        webhook_subscribed: true,
      }),
    ).readChannel(target);
    expect(result).toEqual({
      connected: true,
      phoneNumberId: '1234567890',
      name: '+57 300 000 0000',
    });
    expect(
      await new HttpKiviNotificationSettingsGateway(
        options({ channel: 'whatsapp', connected: false, external_id: '99' }),
      ).readChannel(target),
    ).toEqual({ connected: false, phoneNumberId: null, name: null });
  });
  it('reads a regional Meta locale without replacing it with a base language', async (): Promise<void> => {
    const settings = await new HttpKiviNotificationSettingsGateway(
      options({
        whatsapp_enabled: true,
        widget_enabled: false,
        template_name: 'order_update',
        language: 'en_US',
      }),
    ).readSettings(target);
    expect(settings.language).toBe('en_US');
  });
  it('treats a missing Kivi widget as skipped, not as an error', async (): Promise<void> => {
    const ok = options({ enabled: true });
    expect(await new HttpKiviWhatsAppGateway(ok).syncWidgetHandoff(target, true)).toBe(true);
    expect(ok.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/channels/whatsapp/widget-handoff'),
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ enabled: true }) }),
    );
    expect(
      await new HttpKiviWhatsAppGateway(options({ detail: 'x' }, 409)).syncWidgetHandoff(
        target,
        true,
      ),
    ).toBe(false);
    await expect(
      new HttpKiviWhatsAppGateway(options({}, 403)).syncWidgetHandoff(target, true),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('allowlists validation metadata and masks provider secrets and errors', async (): Promise<void> => {
    const result = await new HttpKiviWhatsAppGateway(
      options({ valid: true, phone_display: '+593', verified_name: 'Store', token: 'leaked' }),
    ).validate(target, { phoneNumberId: '123', token: 'secret' });
    expect(result).toEqual({ connected: false, phoneDisplay: '+593', verifiedName: 'Store' });
    await expect(
      new HttpKiviWhatsAppGateway(options({ valid: false, error: 'secret' })).validate(target, {
        phoneNumberId: '123',
        token: 'secret',
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('posts captured order status and stable id using server credential without cookies or redirects', async (): Promise<void> => {
    const opts = options({ status: 'processed', channels: { whatsapp: 'sent' } });
    await new HttpKiviOrderNotificationGateway(opts).deliver(source, event);
    expect(opts.fetch).toHaveBeenCalledWith(
      `${target.baseUrl}/api/v1/connections/${target.connectionId}/notifications/order-status`,
      expect.objectContaining({
        method: 'POST',
        credentials: 'omit',
        redirect: 'error',
        cache: 'no-store',
        headers: expect.objectContaining({ Authorization: `Bearer ${target.token}` }),
        body: JSON.stringify({
          event_id: event.messageId,
          external_order_id: event.aggregateId,
          event_type: event.eventType,
          occurred_at: event.occurredAt,
          phone: source.phone,
          order_number: source.orderNumber,
        }),
      }),
    );
  });
  it('adds the ready-made WhatsApp text to the order status when the source carries one', async (): Promise<void> => {
    const opts = options({ status: 'processed', channels: { whatsapp: 'sent' } });
    await new HttpKiviOrderNotificationGateway(opts).deliver(
      { ...source, message: '*Pedido en preparación*' },
      event,
    );
    expect(opts.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          event_id: event.messageId,
          external_order_id: event.aggregateId,
          event_type: event.eventType,
          occurred_at: event.occurredAt,
          phone: source.phone,
          order_number: source.orderNumber,
          message: '*Pedido en preparación*',
        }),
      }),
    );
  });
  it('omits the phone when the checkout phone was not usable, so Kivi uses the linked chat', async (): Promise<void> => {
    const opts = options({ status: 'processed', channels: { whatsapp: 'sent' } });
    await new HttpKiviOrderNotificationGateway(opts).deliver({ ...source, phone: null }, event);
    expect(opts.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          event_id: event.messageId,
          external_order_id: event.aggregateId,
          event_type: event.eventType,
          occurred_at: event.occurredAt,
          order_number: source.orderNumber,
        }),
      }),
    );
  });
  it('does not acknowledge malformed acceptance from Kivi', async (): Promise<void> => {
    await expect(
      new HttpKiviOrderNotificationGateway(options({ ok: true })).deliver(source, event),
    ).rejects.toMatchObject({ failure: 'transient' });
  });
  it('rejects a private DNS target before sending credentials', async (): Promise<void> => {
    const opts = {
      ...options({ status: 'connected' }),
      resolveAddresses: async (): Promise<string[]> => ['127.0.0.1'],
    };
    await expect(
      new HttpKiviWhatsAppGateway(opts).connect(target, { phoneNumberId: '1', token: 'secret' }),
    ).rejects.toMatchObject({ failure: 'rejected' });
    expect(opts.fetch).not.toHaveBeenCalled();
  });
  it('rejects unsafe connection ids before constructing the URL', async (): Promise<void> => {
    const opts = options({ valid: true });
    await expect(
      new HttpKiviWhatsAppGateway(opts).validate(
        { ...target, connectionId: '../other' },
        { phoneNumberId: '1', token: 'secret' },
      ),
    ).rejects.toMatchObject({ failure: 'rejected' });
    expect(opts.fetch).not.toHaveBeenCalled();
  });
  it('parses settings without leaking extra remote fields', async (): Promise<void> => {
    const settings = await new HttpKiviNotificationSettingsGateway(
      options({
        whatsapp_enabled: true,
        widget_enabled: false,
        template_name: 'order_status',
        language: 'es',
        token: 'leaked',
      }),
    ).readSettings(target);
    expect(settings).toEqual({
      whatsappEnabled: true,
      widgetEnabled: false,
      templateName: 'order_status',
      language: 'es',
    });
  });
});

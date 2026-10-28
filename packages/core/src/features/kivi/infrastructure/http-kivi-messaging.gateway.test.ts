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

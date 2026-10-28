import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configureKiviWhatsAppAction } from '@/features/kivi/actions/kivi-whatsapp.actions';
import { configureKiviNotificationsAction } from '@/features/kivi/actions/kivi-notifications.actions';
import {
  getConfigureKiviWhatsAppUseCase,
  getConfigureKiviNotificationsUseCase,
} from '@/features/kivi/di/kivi.di';
import { createClient } from '@/lib/supabase/server';
import { getActiveTenantQuery } from '@/features/iam/queries/active-tenant.query';
import { KiviConnectionNotFoundException, MessagingException } from '@canaldigital/packages/core';

vi.mock('next-intl/server', (): object => ({
  getTranslations: vi.fn().mockResolvedValue((key: string): string => key),
}));
vi.mock('next/cache', (): object => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', (): object => ({ createClient: vi.fn() }));
vi.mock('@/features/iam/queries/active-tenant.query', (): object => ({
  getActiveTenantQuery: vi.fn(),
}));
vi.mock('@/features/kivi/di/kivi.di', (): object => ({
  getConfigureKiviWhatsAppUseCase: vi.fn(),
  getConfigureKiviNotificationsUseCase: vi.fn(),
}));
const execute = vi.fn();
const initial = { success: false, message: null };
function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('Kivi messaging action boundary', (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
    execute
      .mockReset()
      .mockResolvedValue({ connected: true, phoneDisplay: '+593', verifiedName: 'Store' });
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'server-user' } } }) },
    } as unknown as Awaited<ReturnType<typeof createClient>>);
    vi.mocked(getActiveTenantQuery).mockResolvedValue(
      'server-tenant' as Awaited<ReturnType<typeof getActiveTenantQuery>>,
    );
    vi.mocked(getConfigureKiviWhatsAppUseCase).mockReturnValue({ execute } as unknown as ReturnType<
      typeof getConfigureKiviWhatsAppUseCase
    >);
    vi.mocked(getConfigureKiviNotificationsUseCase).mockReturnValue({
      execute,
    } as unknown as ReturnType<typeof getConfigureKiviNotificationsUseCase>);
  });
  it('ignores forged actor and tenant and never serializes a submitted secret', async (): Promise<void> => {
    const result = await configureKiviWhatsAppAction(
      initial,
      form({
        operation: 'connect',
        phoneNumberId: '123',
        token: 'meta-secret',
        tenantId: 'attacker',
        userId: 'attacker',
      }),
    );
    expect(execute).toHaveBeenCalledWith({
      operation: 'connect',
      phoneNumberId: '123',
      token: 'meta-secret',
      userId: 'server-user',
      tenantId: 'server-tenant',
    });
    expect(JSON.stringify(result)).not.toContain('meta-secret');
  });
  it('retains non-secret input on rejection and masks exception text', async (): Promise<void> => {
    execute.mockRejectedValue(new MessagingException('meta-secret'));
    const result = await configureKiviWhatsAppAction(
      initial,
      form({ operation: 'connect', phoneNumberId: '123', token: 'meta-secret' }),
    );
    expect(result).toMatchObject({ success: false, phoneNumberId: '123', message: 'unavailable' });
    expect(JSON.stringify(result)).not.toContain('meta-secret');
  });
  it('does not coerce a File into credential syntax', async (): Promise<void> => {
    const data = form({ operation: 'connect', phoneNumberId: '123' });
    data.set('token', new File(['secret'], 'token'));
    expect((await configureKiviWhatsAppAction(initial, data)).success).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });
  it('does not truncate an invalid template into a valid value', async (): Promise<void> => {
    const result = await configureKiviNotificationsAction(
      initial,
      form({ templateName: 'a'.repeat(101), language: 'es' }),
    );
    expect(result.success).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });
  it('injects server identity into notification preferences', async (): Promise<void> => {
    const result = await configureKiviNotificationsAction(
      initial,
      form({
        whatsappEnabled: 'on',
        templateName: 'order_update',
        language: 'es',
        tenantId: 'attacker',
      }),
    );
    expect(result.success).toBe(true);
    expect(execute).toHaveBeenCalledWith({
      whatsappEnabled: true,
      widgetEnabled: false,
      templateName: 'order_update',
      language: 'es',
      userId: 'server-user',
      tenantId: 'server-tenant',
    });
  });
  it('rejects a file or unexpected string used as a notification checkbox', async (): Promise<void> => {
    for (const value of [new File(['on'], 'preference'), 'true']) {
      const data = form({ templateName: 'order_update', language: 'es' });
      data.set('whatsappEnabled', value);
      expect((await configureKiviNotificationsAction(initial, data)).success).toBe(false);
    }
    expect(execute).not.toHaveBeenCalled();
  });
  it('maps a removed notification connection to the localized recovery message', async (): Promise<void> => {
    execute.mockRejectedValue(new KiviConnectionNotFoundException());
    expect(
      await configureKiviNotificationsAction(
        initial,
        form({ templateName: 'order_update', language: 'es' }),
      ),
    ).toMatchObject({ success: false, message: 'notLinked' });
  });
  it('retains an invalid phone number ID without silently truncating it', async (): Promise<void> => {
    const phoneNumberId = '1'.repeat(65);
    expect(
      await configureKiviWhatsAppAction(
        initial,
        form({ operation: 'connect', phoneNumberId, token: 'secret' }),
      ),
    ).toMatchObject({ success: false, phoneNumberId });
    expect(execute).not.toHaveBeenCalled();
  });
  it('rejects unauthenticated requests before resolving a tenant or executing a mutation', async (): Promise<void> => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as unknown as Awaited<ReturnType<typeof createClient>>);
    expect((await configureKiviNotificationsAction(initial, form({}))).message).toBe(
      'unauthorized',
    );
    expect((await configureKiviWhatsAppAction(initial, form({}))).message).toBe('unauthorized');
    expect(getActiveTenantQuery).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });
});

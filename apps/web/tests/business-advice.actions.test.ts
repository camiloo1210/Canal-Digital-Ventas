import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTranslator } from 'next-intl';
import {
  BusinessAdviceAccessDeniedException,
  BusinessAdvisorException,
} from '@canaldigital/packages/core';
import es from '@/messages/es.json';
import {
  generateBusinessAdviceAction,
  type BusinessAdviceActionState,
} from '@/features/dashboard/actions/business-advice.actions';

const mocks = vi.hoisted(
  (): {
    getUser: ReturnType<typeof vi.fn>;
    tenant: ReturnType<typeof vi.fn>;
    allowed: ReturnType<typeof vi.fn>;
    execute: ReturnType<typeof vi.fn>;
  } => ({ getUser: vi.fn(), tenant: vi.fn(), allowed: vi.fn(), execute: vi.fn() }),
);
vi.mock('next-intl/server', (): object => ({
  getLocale: async (): Promise<string> => 'es',
  getTranslations: async (): Promise<
    ReturnType<typeof createTranslator<typeof es.BusinessIntelligence>>
  > => createTranslator({ locale: 'es', messages: es.BusinessIntelligence }),
}));
vi.mock('@/lib/supabase/server', (): object => ({
  createClient: async (): Promise<object> => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock('@/features/dashboard/server/resolve-action-tenant', (): object => ({
  resolveActionTenant: mocks.tenant,
}));
vi.mock('@/features/users/queries/member-permissions.query', (): object => ({
  userHasAnyPermission: mocks.allowed,
}));
vi.mock('@/features/dashboard/di/dashboard.di', (): object => ({
  getGenerateBusinessAdviceUseCase: (): object => ({ execute: mocks.execute }),
}));

const initial: BusinessAdviceActionState = {
  status: 'idle',
  errorCode: null,
  message: null,
  advice: null,
  revision: 0,
};
const form = (fields: Record<string, string>): FormData => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};
const advice = { summary: 's', tips: [{ category: 'promotions', title: 't', detail: 'd' }] };

describe('generateBusinessAdviceAction', (): void => {
  beforeEach((): void => {
    vi.resetAllMocks();
    vi.spyOn(console, 'error').mockImplementation((): void => undefined);
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.tenant.mockResolvedValue({ tenantId: 'tenant-1', tenantSlug: 's', role: 'OWNER' });
    mocks.allowed.mockResolvedValue(true);
  });

  it('uses the server-side actor and tenant, never client-submitted ones', async (): Promise<void> => {
    mocks.execute.mockResolvedValue(advice);
    const state = await generateBusinessAdviceAction(
      initial,
      form({ days: '7', userId: 'attacker', authenticatedUserId: 'attacker' }),
    );
    expect(state).toMatchObject({ status: 'success', advice, revision: 1 });
    expect(mocks.execute).toHaveBeenCalledWith({
      authenticatedUserId: 'user-1',
      tenantId: 'tenant-1',
      days: 7,
      leadTimeDays: 7,
      targetCoverageDays: 30,
      locale: 'es',
    });
  });

  it('forwards a valid custom date range', async (): Promise<void> => {
    mocks.execute.mockResolvedValue(advice);
    await generateBusinessAdviceAction(initial, form({ from: '2026-01-01', to: '2026-01-10' }));
    expect(mocks.execute.mock.calls[0][0]).toMatchObject({ days: 10, endDate: '2026-01-10' });
    expect(mocks.execute.mock.calls[0][0]).not.toHaveProperty('query');
  });

  it('refuses without a session, a tenant or the VIEW_REPORTS permission', async (): Promise<void> => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null } });
    expect(await generateBusinessAdviceAction(initial, form({}))).toMatchObject({
      errorCode: 'UNAUTHORIZED',
    });
    mocks.tenant.mockResolvedValueOnce(null);
    expect(await generateBusinessAdviceAction(initial, form({}))).toMatchObject({
      errorCode: 'UNAUTHORIZED',
    });
    mocks.allowed.mockResolvedValueOnce(false);
    expect(await generateBusinessAdviceAction(initial, form({}))).toMatchObject({
      errorCode: 'UNAUTHORIZED',
    });
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it('maps typed failures to localized messages without leaking details', async (): Promise<void> => {
    mocks.execute.mockRejectedValueOnce(new BusinessAdviceAccessDeniedException());
    expect(await generateBusinessAdviceAction(initial, form({}))).toMatchObject({
      errorCode: 'UNAUTHORIZED',
    });
    mocks.execute.mockRejectedValueOnce(new BusinessAdvisorException('not_configured'));
    expect(await generateBusinessAdviceAction(initial, form({}))).toMatchObject({
      errorCode: 'NOT_CONFIGURED',
      message: es.BusinessIntelligence.advisorNotConfigured,
    });
    mocks.execute.mockRejectedValueOnce(
      new BusinessAdvisorException('unavailable', new Error('api key abc123')),
    );
    const unavailable = await generateBusinessAdviceAction(initial, form({}));
    expect(unavailable.errorCode).toBe('UNAVAILABLE');
    expect(JSON.stringify(unavailable)).not.toContain('abc123');
    mocks.execute.mockRejectedValueOnce(new Error('boom'));
    expect(await generateBusinessAdviceAction(initial, form({}))).toMatchObject({
      errorCode: 'UNEXPECTED',
      message: es.BusinessIntelligence.advisorUnexpected,
    });
  });
});

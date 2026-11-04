import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configureKiviKnowledgeAction } from '@/features/kivi/actions/kivi-knowledge.actions';
import { getConfigureKiviKnowledgeUseCase } from '@/features/kivi/di/kivi.di';
import { createClient } from '@/lib/supabase/server';
import { resolveActiveTenantQuery } from '@/features/iam/queries/active-tenant.query';

vi.mock('@/features/users/queries/member-permissions.query', (): object => ({
  userIsOwner: vi.fn(async (): Promise<boolean> => true),
}));
vi.mock('next-intl/server', (): object => ({
  getTranslations: vi.fn().mockResolvedValue((key: string): string => key),
}));
vi.mock('next/cache', (): object => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', (): object => ({ createClient: vi.fn() }));
vi.mock('@/features/iam/queries/active-tenant.query', (): object => ({
  resolveActiveTenantQuery: vi.fn(),
}));
vi.mock('@/features/kivi/di/kivi.di', (): object => ({
  getConfigureKiviKnowledgeUseCase: vi.fn(),
}));

const actor = crypto.randomUUID();
const TENANT = crypto.randomUUID();
const execute = vi.fn();
const initial = { success: false, message: null };

function form(tenantId: string | null): FormData {
  const data = new FormData();
  data.set('operation', 'upload');
  data.set('title', 'Shipping');
  data.set('text', 'We ship in 2 days');
  if (tenantId) data.set('tenantId', tenantId);
  return data;
}

describe('Kivi knowledge action business scoping', (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
    execute.mockReset().mockResolvedValue(undefined);
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: actor } } }) },
    } as unknown as Awaited<ReturnType<typeof createClient>>);
    vi.mocked(resolveActiveTenantQuery).mockImplementation(
      async (
        _user: string,
        id: string,
      ): Promise<Awaited<ReturnType<typeof resolveActiveTenantQuery>>> =>
        id === TENANT
          ? { status: 'ready', tenantId: TENANT, tenantName: 'S', tenantSlug: 's', role: 'OWNER' }
          : null,
    );
    vi.mocked(getConfigureKiviKnowledgeUseCase).mockReturnValue({
      execute,
    } as unknown as ReturnType<typeof getConfigureKiviKnowledgeUseCase>);
  });
  it.each([
    ['missing', null],
    ['foreign', crypto.randomUUID()],
  ])('rejects a %s tenantId without executing', async (_label, id): Promise<void> => {
    const result = await configureKiviKnowledgeAction(initial, form(id));
    expect(result).toMatchObject({ success: false, message: 'contextChanged' });
    expect(execute).not.toHaveBeenCalled();
  });
  it('acts on exactly the verified named business', async (): Promise<void> => {
    const result = await configureKiviKnowledgeAction(initial, form(TENANT));
    expect(result.success).toBe(true);
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ userId: actor, tenantId: TENANT, operation: 'upload' }),
    );
  });
});

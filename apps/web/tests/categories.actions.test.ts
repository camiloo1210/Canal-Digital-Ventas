import { test, expect, vi, describe, beforeEach } from 'vitest';
import {
  archiveCategoryAction,
  createCategoryAction,
  unarchiveCategoryAction,
  updateCategoryAction,
} from '@/features/categories/actions/categories.actions';
import {
  ApplicationException,
  CreateCategoryUseCase,
  ChangeCategoryDetailsUseCase,
} from '@canaldigital/packages/core';
import * as activeTenantQuery from '@/features/iam/queries/active-tenant.query';
import * as categoriesDi from '@/features/categories/di/categories.di';
import { userHasAnyPermission } from '@/features/users/queries/member-permissions.query';

vi.mock('@/features/users/queries/member-permissions.query', (): object => ({
  userHasAnyPermission: vi.fn(async (): Promise<boolean> => true),
}));
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));

vi.mock('@canaldigital/packages/core', () => {
  class ApplicationException extends Error {
    constructor(message: string) {
      super(message);
    }
  }
  class DomainException extends Error {
    constructor(message: string) {
      super(message);
    }
  }
  class OptimisticConcurrencyException extends ApplicationException {
    constructor() {
      super('OptimisticConcurrencyException');
    }
  }
  return {
    ApplicationException,
    DomainException,
    OptimisticConcurrencyException,
    UserPermission: { MANAGE_CATALOG: 'MANAGE_CATALOG' },
  };
});

vi.mock('server-only', () => ({}));
vi.mock('@/features/store/utils/catalog-invalidation', () => ({
  invalidateTenantCatalog: vi.fn(),
}));
vi.mock('@/lib/infrastructure/event-bus/in-memory-event.bus', () => ({
  InMemoryEventBus: vi.fn(),
}));
vi.mock('@/lib/postgres/server', () => ({
  sql: {},
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
      }),
    },
  }),
}));

vi.mock('@/features/iam/queries/active-tenant.query', () => ({
  resolveActiveTenantQuery: vi.fn(),
}));

vi.mock('@/features/categories/di/categories.di', () => ({
  getCreateCategoryUseCase: vi.fn(),
  getChangeCategoryDetailsUseCase: vi.fn(),
  getArchiveCategoryUseCase: vi.fn(),
  getUnarchiveCategoryUseCase: vi.fn(),
}));

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  redirect: vi.fn().mockImplementation(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

const TENANT = '550e8400-e29b-41d4-a716-446655440000';
function member(
  tenantId: string,
): Awaited<ReturnType<typeof activeTenantQuery.resolveActiveTenantQuery>> {
  return { status: 'ready', tenantId, tenantName: 'Store', tenantSlug: 'store', role: 'OWNER' };
}

describe('Categories Actions Tenant Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should reject creation if tenant ID cannot be resolved (isolation guard)', async () => {
    vi.mocked(activeTenantQuery.resolveActiveTenantQuery).mockResolvedValue(null);

    const formData = new FormData();
    formData.append('name', 'Test Category');
    formData.append('tenantId', TENANT);

    const result = await createCategoryAction({ success: false, error: null }, formData);

    expect(result.success).toBe(false);
    expect(result.error).toBe('errors_contextChanged');
    expect(categoriesDi.getCreateCategoryUseCase).not.toHaveBeenCalled();
  });

  test('rejects creation when the member lacks the catalog permission', async () => {
    vi.mocked(activeTenantQuery.resolveActiveTenantQuery).mockResolvedValue(member(TENANT));
    vi.mocked(userHasAnyPermission).mockResolvedValueOnce(false);
    const formData = new FormData();
    formData.append('name', 'Test Category');
    formData.append('tenantId', TENANT);
    const result = await createCategoryAction({ success: false, error: null }, formData);
    expect(result.success).toBe(false);
    expect(result.error).toBe('errors_forbidden');
    expect(categoriesDi.getCreateCategoryUseCase).not.toHaveBeenCalled();
    expect(userHasAnyPermission).toHaveBeenCalledWith('test-user-id', TENANT, ['MANAGE_CATALOG']);
  });

  test('should pass resolved tenant ID to use case, ignoring any fake tenant ID in formData', async () => {
    const realTenantId = TENANT;
    vi.mocked(activeTenantQuery.resolveActiveTenantQuery).mockResolvedValue(member(TENANT));

    const mockExecute = vi.fn().mockResolvedValue(undefined);
    vi.mocked(categoriesDi.getCreateCategoryUseCase).mockReturnValue({
      execute: mockExecute,
    } as unknown as CreateCategoryUseCase);

    const formData = new FormData();
    formData.append('name', 'Valid Category');
    formData.append('tenantId', TENANT);

    try {
      await createCategoryAction({ success: false, error: null }, formData);
    } catch (e: unknown) {
      if ((e as Error).message !== 'NEXT_REDIRECT') {
        throw e;
      }
    }

    expect(mockExecute).toHaveBeenCalledTimes(1);
    const callArgs = mockExecute.mock.calls[0][0];

    // The tenant is the one the page named AND the server verified as an active membership.
    expect(activeTenantQuery.resolveActiveTenantQuery).toHaveBeenCalledWith('test-user-id', TENANT);
    expect(callArgs.tenantId).toBe(realTenantId);
  });

  test('should return concurrency_error when optimistic locking fails during update', async () => {
    vi.mocked(activeTenantQuery.resolveActiveTenantQuery).mockResolvedValue(member(TENANT));

    // Mock the use case to throw an OptimisticConcurrencyException
    class OptimisticConcurrencyException extends ApplicationException {
      constructor() {
        super('Version mismatch');
        this.name = 'OptimisticConcurrencyException';
      }
    }

    const mockExecute = vi.fn().mockRejectedValue(new OptimisticConcurrencyException());
    vi.mocked(categoriesDi.getChangeCategoryDetailsUseCase).mockReturnValue({
      execute: mockExecute,
    } as unknown as ChangeCategoryDetailsUseCase);

    const formData = new FormData();
    formData.append('categoryId', '550e8400-e29b-41d4-a716-446655440000');
    formData.append('expectedVersion', '1');
    formData.append('name', 'Updated Name');
    formData.append('tenantId', TENANT);

    const result = await updateCategoryAction({ success: false, error: null }, formData);

    expect(result.success).toBe(false);
    expect(result.error).toBe('errors_concurrency');
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  describe('explicit business on every mutation', () => {
    const FOREIGN = '660e8400-e29b-41d4-a716-446655440001';
    beforeEach(() => {
      vi.mocked(activeTenantQuery.resolveActiveTenantQuery).mockImplementation(
        async (_user: string, tenantId: string) => (tenantId === TENANT ? member(TENANT) : null),
      );
    });
    function createData(tenantId?: string): FormData {
      const data = new FormData();
      data.append('name', 'Valid Category');
      if (tenantId) data.append('tenantId', tenantId);
      return data;
    }
    function updateData(tenantId?: string): FormData {
      const data = createData(tenantId);
      data.append('categoryId', TENANT);
      data.append('expectedVersion', '1');
      return data;
    }
    const idle = { success: false, error: null };
    test.each([
      ['missing', undefined],
      ['foreign', FOREIGN],
    ])('create rejects a %s tenantId without executing', async (_label, id) => {
      const result = await createCategoryAction(idle, createData(id));
      expect(result.error).toBe('errors_contextChanged');
      expect(categoriesDi.getCreateCategoryUseCase).not.toHaveBeenCalled();
    });
    test.each([
      ['missing', undefined],
      ['foreign', FOREIGN],
    ])('update rejects a %s tenantId without executing', async (_label, id) => {
      const result = await updateCategoryAction(idle, updateData(id));
      expect(result.error).toBe('errors_contextChanged');
      expect(categoriesDi.getChangeCategoryDetailsUseCase).not.toHaveBeenCalled();
    });
    test.each([
      ['missing', ''],
      ['foreign', FOREIGN],
    ])('archive rejects a %s tenantId without executing', async (_label, id) => {
      const result = await archiveCategoryAction(TENANT, id);
      expect(result).toEqual({ success: false, error: 'errors_contextChanged' });
      expect(categoriesDi.getArchiveCategoryUseCase).not.toHaveBeenCalled();
    });
    test.each([
      ['missing', ''],
      ['foreign', FOREIGN],
    ])('unarchive rejects a %s tenantId without executing', async (_label, id) => {
      const result = await unarchiveCategoryAction(TENANT, id);
      expect(result).toEqual({ success: false, error: 'errors_contextChanged' });
      expect(categoriesDi.getUnarchiveCategoryUseCase).not.toHaveBeenCalled();
    });
    test('archive runs against the explicitly named business', async () => {
      const execute = vi.fn().mockResolvedValue(undefined);
      vi.mocked(categoriesDi.getArchiveCategoryUseCase).mockReturnValue({
        execute,
      } as unknown as ReturnType<typeof categoriesDi.getArchiveCategoryUseCase>);
      expect(await archiveCategoryAction('cat', TENANT)).toEqual({ success: true, error: null });
      expect(execute).toHaveBeenCalledWith({ id: 'cat', tenantId: TENANT });
    });
  });
});

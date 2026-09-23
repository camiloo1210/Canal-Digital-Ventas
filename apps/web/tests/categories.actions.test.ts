import { test, expect, vi, describe, beforeEach } from 'vitest';
import { createCategoryAction, updateCategoryAction } from '@/features/categories/actions/categories.actions';
import { ApplicationException, CreateCategoryUseCase, ChangeCategoryDetailsUseCase } from '@canaldigital/packages/core';
import * as activeTenantQuery from '@/features/iam/queries/active-tenant.query';
import * as categoriesDi from '@/features/categories/di/categories.di';

vi.mock('@canaldigital/packages/core', () => {
  class ApplicationException extends Error {
    constructor(message: string) { super(message); }
  }
  class DomainException extends Error {
    constructor(message: string) { super(message); }
  }
  class OptimisticConcurrencyException extends ApplicationException {
    constructor() { super('OptimisticConcurrencyException'); }
  }
  return { ApplicationException, DomainException, OptimisticConcurrencyException };
});

vi.mock('server-only', () => ({}));
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
  getActiveTenantQuery: vi.fn(),
}));

vi.mock('@/features/categories/di/categories.di', () => ({
  getCreateCategoryUseCase: vi.fn(),
  getChangeCategoryDetailsUseCase: vi.fn(),
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

describe('Categories Actions Tenant Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should reject creation if tenant ID cannot be resolved (isolation guard)', async () => {
    vi.mocked(activeTenantQuery.getActiveTenantQuery).mockResolvedValue(null);

    const formData = new FormData();
    formData.append('name', 'Test Category');

    const result = await createCategoryAction({ success: false, error: null }, formData);

    expect(result.success).toBe(false);
    expect(result.error).toBe('User does not have an assigned tenant ID.');
    expect(categoriesDi.getCreateCategoryUseCase).not.toHaveBeenCalled();
  });

  test('should pass resolved tenant ID to use case, ignoring any fake tenant ID in formData', async () => {
    
    const realTenantId = '550e8400-e29b-41d4-a716-446655440000' as never;
    vi.mocked(activeTenantQuery.getActiveTenantQuery).mockResolvedValue(realTenantId);

    const mockExecute = vi.fn().mockResolvedValue(undefined);
    vi.mocked(categoriesDi.getCreateCategoryUseCase).mockReturnValue({
      execute: mockExecute,
    } as unknown as CreateCategoryUseCase);

    const formData = new FormData();
    formData.append('name', 'Valid Category');
    formData.append('tenantId', 'fake-tenant-id-attacker'); // Attacker tries to inject tenant ID

    try {
      await createCategoryAction({ success: false, error: null }, formData);
    } catch (e: unknown) {
      if ((e as Error).message !== 'NEXT_REDIRECT') {
        throw e;
      }
    }

    expect(mockExecute).toHaveBeenCalledTimes(1);
    const callArgs = mockExecute.mock.calls[0][0];

    // The use case should receive the real tenant ID derived from the auth session,
    // NOT the one injected via formData.
    expect(callArgs.tenantId).toBe(realTenantId);
    expect(callArgs.tenantId).not.toBe('fake-tenant-id-attacker');
  });

  test('should return concurrency_error when optimistic locking fails during update', async () => {
    
    const realTenantId = '550e8400-e29b-41d4-a716-446655440000' as never;
    vi.mocked(activeTenantQuery.getActiveTenantQuery).mockResolvedValue(realTenantId);

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

    const result = await updateCategoryAction({ success: false, error: null }, formData);

    expect(result.success).toBe(false);
    expect(result.error).toBe('concurrency_error');
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });
});

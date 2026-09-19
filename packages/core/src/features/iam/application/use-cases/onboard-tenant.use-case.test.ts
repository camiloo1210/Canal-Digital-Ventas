import { describe, it, expect, vi, beforeEach, Mocked } from 'vitest';
import { OnboardTenantUseCase } from '@/iam/application/use-cases/onboard-tenant.use-case';
import { TenantRepositoryPort } from '@/tenants/application/ports/out/tenant-repository.port';
import { UserRepositoryPort } from '@/iam/application/ports/out/user-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { OnboardTenantDto } from '@/iam/application/dtos/onboard-tenant.dto';
import { SlugAlreadyTakenException } from '@/tenants/application/exceptions/slug-already-taken.exception';

describe('OnboardTenantUseCase', () => {
  let useCase: OnboardTenantUseCase;
  let mockTenantRepo: Mocked<TenantRepositoryPort>;
  let mockUserRepo: Mocked<UserRepositoryPort>;
  let mockEventBus: Mocked<EventBusPort>;

  const validDto: OnboardTenantDto = {
    tenantId: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Store',
    slug: 'test-store',
    contactEmail: 'store@example.com',
    userEmail: 'owner@example.com',
    firstName: 'John',
    lastName: 'Doe',
    baseCurrency: 'USD',
  };

  const currentUserId = '123e4567-e89b-12d3-a456-426614174001';
  const idempotencyKey = '999e4567-e89b-12d3-a456-426614174999';

  beforeEach(() => {
    mockTenantRepo = {
      save: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(),
      findBySlug: vi.fn(),
      findAll: vi.fn(),
      searchByFilters: vi.fn(),
      onboard: vi.fn(),
    } as unknown as Mocked<TenantRepositoryPort>;

    mockUserRepo = {
      save: vi.fn(),
      findById: vi.fn(),
      findByTenantId: vi.fn(),
      findAll: vi.fn(),
    } as unknown as Mocked<UserRepositoryPort>;

    mockEventBus = {
      publish: vi.fn(),
    } as unknown as Mocked<EventBusPort>;

    useCase = new OnboardTenantUseCase(mockTenantRepo, mockUserRepo, mockEventBus);
  });

  it('should successfully onboard a new tenant', async () => {
    mockTenantRepo.onboard.mockResolvedValue();
    mockEventBus.publish.mockResolvedValue();

    await useCase.execute(validDto, currentUserId, idempotencyKey);

    expect(mockTenantRepo.onboard).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).toHaveBeenCalled();
  });

  it('should throw SlugAlreadyTakenException if repository throws it (unique constraint)', async () => {
    mockTenantRepo.onboard.mockRejectedValue(new SlugAlreadyTakenException('test-store'));

    await expect(useCase.execute(validDto, currentUserId, idempotencyKey)).rejects.toThrow(
      SlugAlreadyTakenException,
    );

    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });
});

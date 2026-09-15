import { describe, it, expect, vi, beforeEach, Mocked } from 'vitest';
import { OnboardTenantUseCase } from './onboard-tenant.use-case';
import { TenantRepositoryPort } from '@/tenants/application/ports/out/tenant-repository.port';
import { UserRepositoryPort } from '@/iam/application/ports/out/user-repository.port';
import { AdminAuthPort } from '@/iam/application/ports/out/admin-auth.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { OnboardTenantDto } from '@/iam/application/dtos/onboard-tenant.dto';
import { User } from '@/iam/domain/entities/user.entity';
import { SlugAlreadyTakenException } from '@/tenants/application/exceptions/slug-already-taken.exception';
import { Tenant } from '@/tenants/domain/entities/tenant.entity';
import { TenantName } from '@/tenants/domain/value-objects/tenant-name.vo';
import { TenantSlug } from '@/tenants/domain/value-objects/tenant-slug.vo';
import { Email } from '@/shared/domain/value-objects/email.vo';
import { Currency } from '@/shared/domain/enums/currency.enum';
import { PersonName } from '@/shared/domain/value-objects/person-name.vo';
import { createUserId } from '@/iam/domain/types/user-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';

describe('OnboardTenantUseCase', () => {
  let useCase: OnboardTenantUseCase;
  let mockTenantRepo: Mocked<TenantRepositoryPort>;
  let mockUserRepo: Mocked<UserRepositoryPort>;
  let mockAdminAuth: Mocked<AdminAuthPort>;
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

  beforeEach(() => {
    mockTenantRepo = {
      save: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(),
      findBySlug: vi.fn(),
      findAll: vi.fn(),
      searchByFilters: vi.fn(),
    } as unknown as Mocked<TenantRepositoryPort>;

    mockUserRepo = {
      save: vi.fn(),
      findById: vi.fn(),
      findByTenantId: vi.fn(),
      findAll: vi.fn(),
    } as unknown as Mocked<UserRepositoryPort>;

    mockAdminAuth = {
      setTenantClaim: vi.fn(),
    } as unknown as Mocked<AdminAuthPort>;

    mockEventBus = {
      publish: vi.fn(),
    } as unknown as Mocked<EventBusPort>;

    useCase = new OnboardTenantUseCase(mockTenantRepo, mockUserRepo, mockAdminAuth, mockEventBus);
  });

  it('should successfully onboard a new tenant', async () => {
    mockUserRepo.findById.mockResolvedValue(null);
    mockTenantRepo.save.mockResolvedValue();
    mockUserRepo.save.mockResolvedValue();
    mockAdminAuth.setTenantClaim.mockResolvedValue();
    mockEventBus.publish.mockResolvedValue();

    await useCase.execute(validDto, currentUserId);

    const userId = createUserId(currentUserId);
    const tenantId = createTenantId(validDto.tenantId);

    expect(mockUserRepo.findById).toHaveBeenCalledWith(userId);
    expect(mockTenantRepo.save).toHaveBeenCalledTimes(1);
    expect(mockUserRepo.save).toHaveBeenCalledTimes(1);
    expect(mockAdminAuth.setTenantClaim).toHaveBeenCalledWith(currentUserId, tenantId);
    expect(mockEventBus.publish).toHaveBeenCalled();
  });

  it('should be idempotent and return early if user already has a tenant', async () => {
    const existingUser = User.createOwner(
      createUserId(currentUserId),
      createTenantId(validDto.tenantId),
      Email.create('owner@example.com'),
      PersonName.create('John'),
      PersonName.create('Doe'),
    );
    mockUserRepo.findById.mockResolvedValue(existingUser);

    await useCase.execute(validDto, currentUserId);

    expect(mockTenantRepo.save).not.toHaveBeenCalled();
    expect(mockUserRepo.save).not.toHaveBeenCalled();
    expect(mockAdminAuth.setTenantClaim).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('should throw SlugAlreadyTakenException if repository throws it (unique constraint)', async () => {
    mockUserRepo.findById.mockResolvedValue(null);
    mockTenantRepo.save.mockRejectedValue(new SlugAlreadyTakenException('test-store'));

    await expect(useCase.execute(validDto, currentUserId)).rejects.toThrow(
      SlugAlreadyTakenException,
    );

    expect(mockUserRepo.save).not.toHaveBeenCalled();
    expect(mockAdminAuth.setTenantClaim).not.toHaveBeenCalled();
  });
});

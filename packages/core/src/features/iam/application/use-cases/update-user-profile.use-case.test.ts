import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdateUserProfileUseCase } from '@/iam/application/use-cases/update-user-profile.use-case';
import type { UpdateUserProfileDto } from '@/iam/application/dtos/update-user-profile.dto';
import { UserNotFoundException } from '@/iam/application/exceptions/user-not-found.exception';
import { InvalidPersonNameException } from '@/shared/domain/exceptions/invalid-person-name.exception';
import { UserRole } from '@/iam/domain/enums/role.enum';
import { UserPermission } from '@/iam/domain/enums/permission.enum';
import { UserProfileUpdatedEvent } from '@/iam/domain/events/user-profile-updated.event';
import { createUserId } from '@/iam/domain/types/user-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { InMemoryUserRepository } from '@/testing/in-memory/in-memory-user.repository';
import { FakeEventBus } from '@/testing/fakes/fake-event-bus';
import { buildUser } from '@/testing/builders/user.builder';

const TARGET = '33333333-3333-4333-8333-333333333333';
const ACTOR = '44444444-4444-4444-8444-444444444444';
const TENANT_A = '22222222-2222-4222-8222-222222222222';
const TENANT_B = '55555555-5555-4555-8555-555555555555';

type WithActor<T> = T & { actingUserId: string; actingTenantId: string };

describe('UpdateUserProfileUseCase', (): void => {
  let repo: InMemoryUserRepository;
  let bus: FakeEventBus;
  let useCase: UpdateUserProfileUseCase;

  beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'));
    repo = new InMemoryUserRepository();
    bus = new FakeEventBus();
    useCase = new UpdateUserProfileUseCase(repo, bus);
  });
  afterEach((): void => {
    vi.useRealTimers();
  });

  it('updates trimmed names, saves once and publishes the event', async (): Promise<void> => {
    repo.seed(buildUser({ id: createUserId(TARGET) }));
    await useCase.execute({ userId: TARGET, firstName: '  Luis ', lastName: " O'Neil " });
    const saved = await repo.findById(createUserId(TARGET));
    expect(saved?.getFirstName()?.getValue()).toBe('Luis');
    expect(saved?.getLastName()?.getValue()).toBe("O'Neil");
    expect(repo.saveCount).toBe(1);
    expect(bus.publishedLegacy).toHaveLength(1);
    expect(bus.publishedLegacy[0]).toBeInstanceOf(UserProfileUpdatedEvent);
  });

  it.each([
    ['empty first name', '', 'Gomez'],
    ['blank last name', 'Luis', '   '],
    ['script in first name', '<script>', 'Gomez'],
    ['digits in last name', 'Luis', 'G0mez'],
  ])('rejects %s and saves nothing', async (_label, firstName, lastName): Promise<void> => {
    repo.seed(buildUser({ id: createUserId(TARGET) }));
    await expect((): Promise<void> =>
      useCase.execute({ userId: TARGET, firstName, lastName }),
    ).rejects.toThrow(InvalidPersonNameException);
    expect(repo.saveCount).toBe(0);
    expect((await repo.findById(createUserId(TARGET)))?.getFirstName()?.getValue()).toBe('Ana');
  });

  it('throws UserNotFoundException for a missing user', async (): Promise<void> => {
    await expect((): Promise<void> =>
      useCase.execute({ userId: TARGET, firstName: 'Luis', lastName: 'Perez' }),
    ).rejects.toThrow(UserNotFoundException);
    expect(repo.saveCount).toBe(0);
  });

  // FINDING: no acting user or tenant: any caller can rename a user of ANY tenant by id (IDOR).
  it.fails(
    'rejects an acting user from another tenant and saves nothing',
    async (): Promise<void> => {
      repo.seed(
        buildUser({
          id: createUserId(TARGET),
          tenantId: createTenantId(TENANT_A),
          role: UserRole.EMPLOYEE,
        }),
        buildUser({
          id: createUserId(ACTOR),
          tenantId: createTenantId(TENANT_B),
          role: UserRole.ADMIN,
        }),
      );
      const dto: WithActor<UpdateUserProfileDto> = {
        userId: TARGET,
        firstName: 'Luis',
        lastName: 'Perez',
        actingUserId: ACTOR,
        actingTenantId: TENANT_B,
      };
      await expect((): Promise<void> => useCase.execute(dto)).rejects.toThrow();
      expect(repo.saveCount).toBe(0);
      expect((await repo.findById(createUserId(TARGET)))?.getFirstName()?.getValue()).toBe('Ana');
    },
  );

  // FINDING: no permission check: a different employee without MANAGE_USERS can edit another
  // user's profile (self-service is a separate use case, update-own-profile).
  it.fails(
    'rejects another acting user lacking MANAGE_USERS and saves nothing',
    async (): Promise<void> => {
      repo.seed(
        buildUser({ id: createUserId(TARGET), role: UserRole.EMPLOYEE }),
        buildUser({
          id: createUserId(ACTOR),
          role: UserRole.EMPLOYEE,
          permissions: [UserPermission.VIEW_ORDERS],
        }),
      );
      const dto: WithActor<UpdateUserProfileDto> = {
        userId: TARGET,
        firstName: 'Luis',
        lastName: 'Perez',
        actingUserId: ACTOR,
        actingTenantId: TENANT_A,
      };
      await expect((): Promise<void> => useCase.execute(dto)).rejects.toThrow();
      expect(repo.saveCount).toBe(0);
    },
  );
});

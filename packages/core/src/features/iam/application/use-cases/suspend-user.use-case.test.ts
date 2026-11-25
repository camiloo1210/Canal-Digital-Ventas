import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SuspendUserUseCase } from '@/iam/application/use-cases/suspend-user.use-case';
import type { SuspendUserDto } from '@/iam/application/dtos/suspend-user.dto';
import { UserNotFoundException } from '@/iam/application/exceptions/user-not-found.exception';
import { InvalidUserStateException } from '@/iam/domain/exceptions/invalid-user-state.exception';
import { UserRole } from '@/iam/domain/enums/role.enum';
import { UserStatus } from '@/iam/domain/enums/status.enum';
import { UserPermission } from '@/iam/domain/enums/permission.enum';
import { UserSuspendedEvent } from '@/iam/domain/events/user-suspended.event';
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

describe('SuspendUserUseCase', (): void => {
  let repo: InMemoryUserRepository;
  let bus: FakeEventBus;
  let useCase: SuspendUserUseCase;

  beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'));
    repo = new InMemoryUserRepository();
    bus = new FakeEventBus();
    useCase = new SuspendUserUseCase(repo, bus);
  });
  afterEach((): void => {
    vi.useRealTimers();
  });

  it('suspends an active user, saves once and publishes the event', async (): Promise<void> => {
    repo.seed(buildUser({ id: createUserId(TARGET), role: UserRole.EMPLOYEE }));
    await useCase.execute({ userId: TARGET });
    expect((await repo.findById(createUserId(TARGET)))?.getStatus()).toBe(UserStatus.SUSPENDED);
    expect(repo.saveCount).toBe(1);
    expect(bus.publishedLegacy).toHaveLength(1);
    expect(bus.publishedLegacy[0]).toBeInstanceOf(UserSuspendedEvent);
  });

  it('refuses to suspend the owner and saves nothing', async (): Promise<void> => {
    repo.seed(buildUser({ id: createUserId(TARGET), role: UserRole.OWNER }));
    await expect((): Promise<void> => useCase.execute({ userId: TARGET })).rejects.toThrow(
      InvalidUserStateException,
    );
    expect(repo.saveCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
    expect((await repo.findById(createUserId(TARGET)))?.getStatus()).toBe(UserStatus.ACTIVE);
  });

  it('refuses a second suspension and publishes nothing the second time', async (): Promise<void> => {
    repo.seed(buildUser({ id: createUserId(TARGET), role: UserRole.EMPLOYEE }));
    await useCase.execute({ userId: TARGET });
    await expect((): Promise<void> => useCase.execute({ userId: TARGET })).rejects.toThrow(
      InvalidUserStateException,
    );
    expect(repo.saveCount).toBe(1);
    expect(bus.publishedLegacy).toHaveLength(1);
  });

  it('throws UserNotFoundException for a missing user', async (): Promise<void> => {
    await expect((): Promise<void> => useCase.execute({ userId: TARGET })).rejects.toThrow(
      UserNotFoundException,
    );
    expect(repo.saveCount).toBe(0);
  });

  // FINDING: no acting user or tenant: any caller can suspend a user of ANY tenant by id (IDOR).
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
      const dto: WithActor<SuspendUserDto> = {
        userId: TARGET,
        actingUserId: ACTOR,
        actingTenantId: TENANT_B,
      };
      await expect((): Promise<void> => useCase.execute(dto)).rejects.toThrow();
      expect(repo.saveCount).toBe(0);
      expect((await repo.findById(createUserId(TARGET)))?.getStatus()).toBe(UserStatus.ACTIVE);
    },
  );

  // FINDING: no permission check: an employee without MANAGE_USERS can suspend users.
  it.fails(
    'rejects an acting user lacking MANAGE_USERS and saves nothing',
    async (): Promise<void> => {
      repo.seed(
        buildUser({ id: createUserId(TARGET), role: UserRole.EMPLOYEE }),
        buildUser({
          id: createUserId(ACTOR),
          role: UserRole.EMPLOYEE,
          permissions: [UserPermission.VIEW_ORDERS],
        }),
      );
      const dto: WithActor<SuspendUserDto> = {
        userId: TARGET,
        actingUserId: ACTOR,
        actingTenantId: TENANT_A,
      };
      await expect((): Promise<void> => useCase.execute(dto)).rejects.toThrow();
      expect(repo.saveCount).toBe(0);
    },
  );
});

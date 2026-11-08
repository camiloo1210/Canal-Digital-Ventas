import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChangeUserRoleUseCase } from '@/iam/application/use-cases/change-user-role.use-case';
import type { ChangeUserRoleDto } from '@/iam/application/dtos/change-user-role.dto';
import { UserNotFoundException } from '@/iam/application/exceptions/user-not-found.exception';
import { InvalidRoleException } from '@/iam/domain/exceptions/invalid-role.exception';
import { InvalidUserStateException } from '@/iam/domain/exceptions/invalid-user-state.exception';
import { UserRole } from '@/iam/domain/enums/role.enum';
import { UserPermission } from '@/iam/domain/enums/permission.enum';
import { UserRoleChangedEvent } from '@/iam/domain/events/user-role-changed.event';
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

describe('ChangeUserRoleUseCase', (): void => {
  let repo: InMemoryUserRepository;
  let bus: FakeEventBus;
  let useCase: ChangeUserRoleUseCase;

  beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'));
    repo = new InMemoryUserRepository();
    bus = new FakeEventBus();
    useCase = new ChangeUserRoleUseCase(repo, bus);
  });
  afterEach((): void => {
    vi.useRealTimers();
  });

  it('changes the role, saves once and publishes the role-changed event', async (): Promise<void> => {
    repo.seed(buildUser({ id: createUserId(TARGET), role: UserRole.EMPLOYEE }));
    await useCase.execute({ userId: TARGET, newRole: UserRole.ADMIN });
    const saved = await repo.findById(createUserId(TARGET));
    expect(saved?.getRole()).toBe(UserRole.ADMIN);
    expect(repo.saveCount).toBe(1);
    expect(bus.publishedLegacy).toHaveLength(1);
    expect(bus.publishedLegacy[0]).toBeInstanceOf(UserRoleChangedEvent);
  });

  it('refuses to demote the owner and saves nothing', async (): Promise<void> => {
    repo.seed(buildUser({ id: createUserId(TARGET), role: UserRole.OWNER }));
    await expect((): Promise<void> =>
      useCase.execute({ userId: TARGET, newRole: UserRole.EMPLOYEE }),
    ).rejects.toThrow(InvalidUserStateException);
    expect(repo.saveCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
    expect((await repo.findById(createUserId(TARGET)))?.getRole()).toBe(UserRole.OWNER);
  });

  it('rejects an unknown role before touching the repository', async (): Promise<void> => {
    repo.seed(buildUser({ id: createUserId(TARGET) }));
    await expect((): Promise<void> =>
      useCase.execute({ userId: TARGET, newRole: 'SUPERADMIN' }),
    ).rejects.toThrow(InvalidRoleException);
    expect(repo.saveCount).toBe(0);
  });

  it('throws UserNotFoundException for a missing user', async (): Promise<void> => {
    await expect((): Promise<void> =>
      useCase.execute({ userId: TARGET, newRole: UserRole.ADMIN }),
    ).rejects.toThrow(UserNotFoundException);
    expect(repo.saveCount).toBe(0);
  });

  it('rejects a malformed user id', async (): Promise<void> => {
    await expect((): Promise<void> =>
      useCase.execute({ userId: 'not-a-uuid', newRole: UserRole.ADMIN }),
    ).rejects.toThrow();
    expect(repo.saveCount).toBe(0);
  });

  // FINDING: the use case has no acting user or tenant: any caller can change the role of a user
  // of ANY tenant by id (IDOR). The expected behavior is that an actor from another tenant gets
  // "not found" / forbidden and nothing is saved.
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
      const dto: WithActor<ChangeUserRoleDto> = {
        userId: TARGET,
        newRole: UserRole.ADMIN,
        actingUserId: ACTOR,
        actingTenantId: TENANT_B,
      };
      await expect((): Promise<void> => useCase.execute(dto)).rejects.toThrow();
      expect(repo.saveCount).toBe(0);
      expect((await repo.findById(createUserId(TARGET)))?.getRole()).toBe(UserRole.EMPLOYEE);
    },
  );

  // FINDING: no permission check: an employee without MANAGE_USERS can change roles.
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
      const dto: WithActor<ChangeUserRoleDto> = {
        userId: TARGET,
        newRole: UserRole.ADMIN,
        actingUserId: ACTOR,
        actingTenantId: TENANT_A,
      };
      await expect((): Promise<void> => useCase.execute(dto)).rejects.toThrow();
      expect(repo.saveCount).toBe(0);
    },
  );

  // FINDING (needs a human decision): any user can be promoted to OWNER through this use case,
  // so ownership can be granted without a dedicated transfer flow. Expected: refused.
  it.fails('refuses to promote a non-owner to OWNER', async (): Promise<void> => {
    repo.seed(buildUser({ id: createUserId(TARGET), role: UserRole.EMPLOYEE }));
    await expect((): Promise<void> =>
      useCase.execute({ userId: TARGET, newRole: UserRole.OWNER }),
    ).rejects.toThrow();
    expect(repo.saveCount).toBe(0);
  });
});

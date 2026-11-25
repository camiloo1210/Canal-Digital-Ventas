import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdateUserPermissionsUseCase } from '@/iam/application/use-cases/update-user-permissions.use-case';
import type { UpdateUserPermissionsDto } from '@/iam/application/dtos/update-user-permissions.dto';
import { UserNotFoundException } from '@/iam/application/exceptions/user-not-found.exception';
import { InvalidPermissionException } from '@/iam/domain/exceptions/invalid-permission.exception';
import { InvalidRoleOperationException } from '@/iam/domain/exceptions/invalid-role-operation.exception';
import { UserRole } from '@/iam/domain/enums/role.enum';
import { UserPermission } from '@/iam/domain/enums/permission.enum';
import { UserPermissionsUpdatedEvent } from '@/iam/domain/events/user-permissions-updated.event';
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

describe('UpdateUserPermissionsUseCase', (): void => {
  let repo: InMemoryUserRepository;
  let bus: FakeEventBus;
  let useCase: UpdateUserPermissionsUseCase;

  beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'));
    repo = new InMemoryUserRepository();
    bus = new FakeEventBus();
    useCase = new UpdateUserPermissionsUseCase(repo, bus);
  });
  afterEach((): void => {
    vi.useRealTimers();
  });

  it('replaces the permission set (grants new, revokes missing)', async (): Promise<void> => {
    repo.seed(
      buildUser({
        id: createUserId(TARGET),
        role: UserRole.EMPLOYEE,
        permissions: [UserPermission.VIEW_ORDERS, UserPermission.VIEW_CATALOG],
      }),
    );
    await useCase.execute({
      userId: TARGET,
      permissions: [UserPermission.VIEW_CATALOG, UserPermission.MANAGE_ORDERS],
    });
    const saved = await repo.findById(createUserId(TARGET));
    expect([...(saved?.getPermissions() ?? [])].sort()).toEqual(
      [UserPermission.MANAGE_ORDERS, UserPermission.VIEW_CATALOG].sort(),
    );
    expect(repo.saveCount).toBe(1);
    expect(
      bus.publishedLegacy.every((e): boolean => e instanceof UserPermissionsUpdatedEvent),
    ).toBe(true);
    expect(bus.publishedLegacy.length).toBeGreaterThan(0);
  });

  it('is idempotent: applying the same set twice changes nothing and emits no new event', async (): Promise<void> => {
    repo.seed(buildUser({ id: createUserId(TARGET), role: UserRole.EMPLOYEE }));
    const dto: UpdateUserPermissionsDto = {
      userId: TARGET,
      permissions: [UserPermission.VIEW_ORDERS, UserPermission.VIEW_CATALOG],
    };
    await useCase.execute(dto);
    const afterFirst = await repo.findById(createUserId(TARGET));
    const eventsAfterFirst = bus.publishedLegacy.length;

    await useCase.execute(dto);
    const afterSecond = await repo.findById(createUserId(TARGET));

    expect(afterSecond?.getPermissions()).toEqual(afterFirst?.getPermissions());
    expect(afterSecond?.getVersion()).toBe(afterFirst?.getVersion());
    expect(bus.publishedLegacy).toHaveLength(eventsAfterFirst);
  });

  it('ignores duplicate permissions in the request', async (): Promise<void> => {
    repo.seed(buildUser({ id: createUserId(TARGET), role: UserRole.EMPLOYEE }));
    await useCase.execute({
      userId: TARGET,
      permissions: [UserPermission.VIEW_ORDERS, UserPermission.VIEW_ORDERS],
    });
    expect((await repo.findById(createUserId(TARGET)))?.getPermissions()).toEqual([
      UserPermission.VIEW_ORDERS,
    ]);
  });

  it('rejects an unknown permission and saves nothing', async (): Promise<void> => {
    repo.seed(buildUser({ id: createUserId(TARGET), role: UserRole.EMPLOYEE }));
    await expect((): Promise<void> =>
      useCase.execute({ userId: TARGET, permissions: [UserPermission.VIEW_ORDERS, 'ROOT'] }),
    ).rejects.toThrow(InvalidPermissionException);
    expect(repo.saveCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
  });

  it('refuses discrete permissions on the owner and saves nothing', async (): Promise<void> => {
    repo.seed(buildUser({ id: createUserId(TARGET), role: UserRole.OWNER }));
    await expect((): Promise<void> =>
      useCase.execute({ userId: TARGET, permissions: [UserPermission.VIEW_ORDERS] }),
    ).rejects.toThrow(InvalidRoleOperationException);
    expect(repo.saveCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
  });

  it('throws UserNotFoundException for a missing user', async (): Promise<void> => {
    await expect((): Promise<void> =>
      useCase.execute({ userId: TARGET, permissions: [] }),
    ).rejects.toThrow(UserNotFoundException);
    expect(repo.saveCount).toBe(0);
  });

  // FINDING: no acting user or tenant: any caller can rewrite permissions of ANY tenant's user
  // (IDOR / privilege escalation).
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
      const dto: WithActor<UpdateUserPermissionsDto> = {
        userId: TARGET,
        permissions: [UserPermission.MANAGE_USERS],
        actingUserId: ACTOR,
        actingTenantId: TENANT_B,
      };
      await expect((): Promise<void> => useCase.execute(dto)).rejects.toThrow();
      expect(repo.saveCount).toBe(0);
      expect((await repo.findById(createUserId(TARGET)))?.getPermissions()).toEqual([]);
    },
  );

  // FINDING: no permission check: an employee without MANAGE_USERS can grant permissions.
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
      const dto: WithActor<UpdateUserPermissionsDto> = {
        userId: TARGET,
        permissions: [UserPermission.MANAGE_USERS],
        actingUserId: ACTOR,
        actingTenantId: TENANT_A,
      };
      await expect((): Promise<void> => useCase.execute(dto)).rejects.toThrow();
      expect(repo.saveCount).toBe(0);
    },
  );
});

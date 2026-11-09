import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InviteUserUseCase } from '@/iam/application/use-cases/invite-user.use-case';
import { InvalidRoleException } from '@/iam/domain/exceptions/invalid-role.exception';
import { InvalidEmailException } from '@/shared/domain/exceptions/invalid-email.exception';
import { UserRole } from '@/iam/domain/enums/role.enum';
import { UserStatus } from '@/iam/domain/enums/status.enum';
import { UserInvitedEvent } from '@/iam/domain/events/user-invited.event';
import { createUserId } from '@/iam/domain/types/user-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { Email } from '@/shared/domain/value-objects/email.vo';
import { InMemoryUserRepository } from '@/testing/in-memory/in-memory-user.repository';
import { FakeEventBus } from '@/testing/fakes/fake-event-bus';
import { buildUser } from '@/testing/builders/user.builder';

const NEW_ID = '66666666-6666-4666-8666-666666666666';
const EXISTING_ID = '33333333-3333-4333-8333-333333333333';
const TENANT_A = '22222222-2222-4222-8222-222222222222';
const TENANT_B = '55555555-5555-4555-8555-555555555555';

describe('InviteUserUseCase', (): void => {
  let repo: InMemoryUserRepository;
  let bus: FakeEventBus;
  let useCase: InviteUserUseCase;

  beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'));
    repo = new InMemoryUserRepository();
    bus = new FakeEventBus();
    useCase = new InviteUserUseCase(repo, bus);
  });
  afterEach((): void => {
    vi.useRealTimers();
  });

  it('saves an INVITED user with a normalized email and publishes the invitation', async (): Promise<void> => {
    await useCase.execute({
      userId: NEW_ID,
      tenantId: TENANT_A,
      email: '  New.Staff@Example.COM ',
      role: UserRole.EMPLOYEE,
    });
    const saved = await repo.findById(createUserId(NEW_ID));
    expect(saved?.getStatus()).toBe(UserStatus.INVITED);
    expect(saved?.getEmail().getValue()).toBe('new.staff@example.com');
    expect(saved?.getTenantId()).toBe(TENANT_A);
    expect(repo.saveCount).toBe(1);
    expect(bus.publishedLegacy).toHaveLength(1);
    expect(bus.publishedLegacy[0]).toBeInstanceOf(UserInvitedEvent);
  });

  it('rejects an invalid email and saves nothing', async (): Promise<void> => {
    await expect((): Promise<void> =>
      useCase.execute({ userId: NEW_ID, tenantId: TENANT_A, email: 'nope', role: UserRole.ADMIN }),
    ).rejects.toThrow(InvalidEmailException);
    expect(repo.saveCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
  });

  it('rejects an unknown role and saves nothing', async (): Promise<void> => {
    await expect((): Promise<void> =>
      useCase.execute({
        userId: NEW_ID,
        tenantId: TENANT_A,
        email: 'a@example.com',
        role: 'ROOT',
      }),
    ).rejects.toThrow(InvalidRoleException);
    expect(repo.saveCount).toBe(0);
  });

  it('rejects a blank tenant id and saves nothing', async (): Promise<void> => {
    await expect((): Promise<void> =>
      useCase.execute({
        userId: NEW_ID,
        tenantId: ' ',
        email: 'a@example.com',
        role: UserRole.ADMIN,
      }),
    ).rejects.toThrow();
    expect(repo.saveCount).toBe(0);
  });

  it('allows the same email to be invited in a different tenant', async (): Promise<void> => {
    repo.seed(
      buildUser({
        id: createUserId(EXISTING_ID),
        tenantId: createTenantId(TENANT_B),
        email: Email.create('dup@example.com'),
      }),
    );
    await useCase.execute({
      userId: NEW_ID,
      tenantId: TENANT_A,
      email: 'dup@example.com',
      role: UserRole.EMPLOYEE,
    });
    expect(repo.saveCount).toBe(1);
  });

  // FINDING: inviting an email that already belongs to a member of the tenant is not detected:
  // a second user row is saved and a second invitation event is published. Expected: a duplicate
  // error, nothing saved and no second invitation.
  it.fails(
    'returns a duplicate error and sends no second invitation for an existing member',
    async (): Promise<void> => {
      repo.seed(
        buildUser({
          id: createUserId(EXISTING_ID),
          tenantId: createTenantId(TENANT_A),
          email: Email.create('dup@example.com'),
        }),
      );
      await expect((): Promise<void> =>
        useCase.execute({
          userId: NEW_ID,
          tenantId: TENANT_A,
          email: 'DUP@example.com',
          role: UserRole.EMPLOYEE,
        }),
      ).rejects.toThrow();
      expect(repo.saveCount).toBe(0);
      expect(bus.publishedLegacy).toHaveLength(0);
      expect(await repo.findByTenantId(createTenantId(TENANT_A))).toHaveLength(1);
    },
  );

  // FINDING: the use case has no acting user: anyone can invite into any tenant, including with
  // the OWNER role. Expected: an actor lacking MANAGE_USERS or from another tenant is rejected.
  it.fails(
    'rejects an acting user from another tenant and saves nothing',
    async (): Promise<void> => {
      const dto = {
        userId: NEW_ID,
        tenantId: TENANT_A,
        email: 'a@example.com',
        role: UserRole.EMPLOYEE,
        actingUserId: EXISTING_ID,
        actingTenantId: TENANT_B,
      };
      repo.seed(buildUser({ id: createUserId(EXISTING_ID), tenantId: createTenantId(TENANT_B) }));
      await expect((): Promise<void> => useCase.execute(dto)).rejects.toThrow();
      expect(repo.saveCount).toBe(0);
    },
  );

  // FINDING: userId comes from the DTO and save is an upsert by id: inviting with the id of a user
  // of another tenant overwrites that user (takeover). Expected: rejected, other user untouched.
  it.fails(
    'does not overwrite a user of another tenant when the userId collides',
    async (): Promise<void> => {
      repo.seed(
        buildUser({
          id: createUserId(EXISTING_ID),
          tenantId: createTenantId(TENANT_B),
          email: Email.create('victim@example.com'),
        }),
      );
      await expect((): Promise<void> =>
        useCase.execute({
          userId: EXISTING_ID,
          tenantId: TENANT_A,
          email: 'attacker@example.com',
          role: UserRole.ADMIN,
        }),
      ).rejects.toThrow();
      expect((await repo.findById(createUserId(EXISTING_ID)))?.getTenantId()).toBe(TENANT_B);
    },
  );

  // FINDING (needs a human decision): a user can be invited directly as OWNER.
  it.fails('refuses to invite a user as OWNER', async (): Promise<void> => {
    await expect((): Promise<void> =>
      useCase.execute({
        userId: NEW_ID,
        tenantId: TENANT_A,
        email: 'a@example.com',
        role: UserRole.OWNER,
      }),
    ).rejects.toThrow();
    expect(repo.saveCount).toBe(0);
  });
});

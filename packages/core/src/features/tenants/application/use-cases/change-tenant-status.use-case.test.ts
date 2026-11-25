import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChangeTenantStatusUseCase } from '@/tenants/application/use-cases/change-tenant-status.use-case';
import { InMemoryTenantRepository } from '@/testing/in-memory/in-memory-tenant.repository';
import { FakeEventBus } from '@/testing/fakes/fake-event-bus';
import { buildTenant } from '@/testing/builders/tenant.builder';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { TenantStatus } from '@/tenants/domain/enums/tenant-status.enum';
import { TenantNotFoundException } from '@/tenants/application/exceptions/tenant-not-found.exception';
import { UnsupportedTenantStatusException } from '@/tenants/application/exceptions/unsupported-tenant-status.exception';
import { InvalidTenantStateException } from '@/tenants/domain/exceptions/invalid-tenant-state.exception';
import { InvalidTenantAttributeException } from '@/tenants/domain/exceptions/invalid-tenant-attribute.exception';
import { TenantActivatedEvent } from '@/tenants/domain/events/tenant-activated.event';
import { TenantSuspendedEvent } from '@/tenants/domain/events/tenant-suspended.event';
import { TenantArchivedEvent } from '@/tenants/domain/events/tenant-archived.event';

const NOW = new Date('2026-01-15T12:00:00.000Z');
const ID = 'tenant-1';

interface Harness {
  repo: InMemoryTenantRepository;
  bus: FakeEventBus;
  useCase: ChangeTenantStatusUseCase;
}

function setup(): Harness {
  const repo = new InMemoryTenantRepository();
  const bus = new FakeEventBus();
  return { repo, bus, useCase: new ChangeTenantStatusUseCase(repo, bus) };
}

async function statusOf(repo: InMemoryTenantRepository): Promise<TenantStatus | undefined> {
  return (await repo.findById(createTenantId(ID)))?.getStatus();
}

describe('ChangeTenantStatusUseCase', (): void => {
  beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach((): void => {
    vi.useRealTimers();
  });

  it('activates a pending tenant, saves and publishes TenantActivatedEvent', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildTenant({ status: TenantStatus.PENDING_SETUP }));

    await useCase.execute({ tenantId: ID, status: 'active' });

    expect(await statusOf(repo)).toBe(TenantStatus.ACTIVE);
    expect(repo.updateCount).toBe(1);
    expect(bus.publishedLegacy).toHaveLength(1);
    expect(bus.publishedLegacy[0]).toBeInstanceOf(TenantActivatedEvent);
  });

  it('suspends with the given reason', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildTenant());

    await useCase.execute({ tenantId: ID, status: 'suspended', reason: 'Non payment' });

    expect(await statusOf(repo)).toBe(TenantStatus.SUSPENDED);
    expect(bus.publishedLegacy[0]).toBeInstanceOf(TenantSuspendedEvent);
    expect(bus.publishedLegacy[0].reason).toBe('Non payment');
  });

  it('suspends with the default reason when none is given', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildTenant());

    await useCase.execute({ tenantId: ID, status: 'suspended' });

    expect(bus.publishedLegacy[0].reason).toBe('Suspended by admin request');
  });

  it('archives the tenant', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildTenant());

    await useCase.execute({ tenantId: ID, status: 'archived' });

    expect(await statusOf(repo)).toBe(TenantStatus.ARCHIVED);
    expect(bus.publishedLegacy[0]).toBeInstanceOf(TenantArchivedEvent);
  });

  it('bumps the version on a successful transition', async (): Promise<void> => {
    const { repo, useCase } = setup();
    repo.seed(buildTenant({ version: 4 }));

    await useCase.execute({ tenantId: ID, status: 'suspended', reason: 'x' });

    expect((await repo.findById(createTenantId(ID)))?.getVersion()).toBe(5);
  });

  it('throws TenantNotFoundException for an unknown tenant and writes nothing', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildTenant({ id: createTenantId('tenant-2') }));

    await expect((): Promise<void> =>
      useCase.execute({ tenantId: ID, status: 'active' }),
    ).rejects.toBeInstanceOf(TenantNotFoundException);

    expect(repo.updateCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
  });

  it('rejects an unknown status string and writes nothing', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildTenant());

    await expect((): Promise<void> =>
      useCase.execute({ tenantId: ID, status: 'deleted' }),
    ).rejects.toBeInstanceOf(InvalidTenantAttributeException);

    expect(repo.updateCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
  });

  it('rejects pending_setup as a target status', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildTenant());

    await expect((): Promise<void> =>
      useCase.execute({ tenantId: ID, status: 'pending_setup' }),
    ).rejects.toBeInstanceOf(UnsupportedTenantStatusException);

    expect(repo.updateCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
  });

  it.each([
    ['active', TenantStatus.ACTIVE, 'active'],
    ['suspended', TenantStatus.SUSPENDED, 'suspended'],
    ['archived', TenantStatus.ARCHIVED, 'archived'],
  ])(
    'rejects the same status %s and leaves the tenant untouched',
    async (_label, current, target): Promise<void> => {
      const { repo, bus, useCase } = setup();
      repo.seed(buildTenant({ status: current }));

      await expect((): Promise<void> =>
        useCase.execute({ tenantId: ID, status: target, reason: 'r' }),
      ).rejects.toBeInstanceOf(InvalidTenantStateException);

      expect(await statusOf(repo)).toBe(current);
      expect(repo.updateCount).toBe(0);
      expect(bus.publishedLegacy).toHaveLength(0);
    },
  );

  it.each(['active', 'suspended'])(
    'cannot move an archived tenant to %s',
    async (target): Promise<void> => {
      const { repo, bus, useCase } = setup();
      repo.seed(buildTenant({ status: TenantStatus.ARCHIVED }));

      await expect((): Promise<void> =>
        useCase.execute({ tenantId: ID, status: target, reason: 'r' }),
      ).rejects.toBeInstanceOf(InvalidTenantStateException);

      expect(await statusOf(repo)).toBe(TenantStatus.ARCHIVED);
      expect(repo.updateCount).toBe(0);
      expect(bus.publishedLegacy).toHaveLength(0);
    },
  );
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateTenantUseCase } from '@/tenants/application/use-cases/create-tenant.use-case';
import { InMemoryTenantRepository } from '@/testing/in-memory/in-memory-tenant.repository';
import { FakeEventBus } from '@/testing/fakes/fake-event-bus';
import { buildTenant } from '@/testing/builders/tenant.builder';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { TenantSlug } from '@/tenants/domain/value-objects/tenant-slug.vo';
import { TenantStatus } from '@/tenants/domain/enums/tenant-status.enum';
import { Currency } from '@/shared/domain/enums/currency.enum';
import { TenantSlugAlreadyInUseException } from '@/tenants/application/exceptions/tenant-slug-already-in-use.exception';
import { InvalidTenantIdException } from '@/shared/domain/exceptions/invalid-tenant-id.exception';
import { TenantCreatedEvent } from '@/tenants/domain/events/tenant-created.event';
import type { CreateTenantDto } from '@/tenants/application/dtos/create-tenant.dto';

const NOW = new Date('2026-01-15T12:00:00.000Z');

function dto(overrides: Partial<CreateTenantDto> = {}): CreateTenantDto {
  return {
    id: 'tenant-new',
    name: 'New store',
    slug: 'new-store',
    contactEmail: 'owner@example.com',
    baseCurrency: 'COP',
    ...overrides,
  };
}

interface Harness {
  repo: InMemoryTenantRepository;
  bus: FakeEventBus;
  useCase: CreateTenantUseCase;
}

function setup(): Harness {
  const repo = new InMemoryTenantRepository();
  const bus = new FakeEventBus();
  return { repo, bus, useCase: new CreateTenantUseCase(repo, bus) };
}

describe('CreateTenantUseCase', (): void => {
  beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach((): void => {
    vi.useRealTimers();
  });

  it('creates a pending-setup tenant, saves it and publishes TenantCreatedEvent', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();

    await useCase.execute(dto({ taxId: '900', customDomain: 'shop.example.com', logoUrl: '' }));

    const stored = await repo.findById(createTenantId('tenant-new'));
    expect(stored?.getStatus()).toBe(TenantStatus.PENDING_SETUP);
    expect(stored?.getSlug().getValue()).toBe('new-store');
    expect(stored?.getBaseCurrency()).toBe(Currency.COP);
    expect(stored?.getTaxId()).toBe('900');
    expect(stored?.getCustomDomain()).toBe('shop.example.com');
    expect(stored?.getLogoUrl()).toBeNull();
    expect(stored?.getVersion()).toBe(0);
    expect(repo.saveCount).toBe(1);
    expect(bus.publishedLegacy).toHaveLength(1);
    expect(bus.publishedLegacy[0]).toBeInstanceOf(TenantCreatedEvent);
    expect(bus.publishedLegacy[0].tenantId).toBe('tenant-new');
  });

  it('rejects a duplicate slug and saves and publishes nothing', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildTenant({ slug: TenantSlug.create('new-store') }));

    await expect((): Promise<void> =>
      useCase.execute(dto({ id: 'tenant-other' })),
    ).rejects.toBeInstanceOf(TenantSlugAlreadyInUseException);

    expect(repo.saveCount).toBe(0);
    expect(await repo.findById(createTenantId('tenant-other'))).toBeNull();
    expect(bus.publishedLegacy).toHaveLength(0);
  });

  it('allows a different slug when another tenant already exists', async (): Promise<void> => {
    const { repo, useCase } = setup();
    repo.seed(buildTenant());

    await useCase.execute(dto());

    expect(repo.saveCount).toBe(1);
  });

  it.each([
    ['empty name', { name: '' }],
    ['invalid slug', { slug: 'Not A Slug' }],
    ['invalid email', { contactEmail: 'nope' }],
    ['unsupported currency', { baseCurrency: 'XXX' }],
  ])('rejects %s and writes nothing', async (_label, overrides): Promise<void> => {
    const { repo, bus, useCase } = setup();

    await expect((): Promise<void> => useCase.execute(dto(overrides))).rejects.toThrow();

    expect(repo.saveCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
  });

  it('rejects an empty tenant id with a domain exception and writes nothing', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();

    await expect((): Promise<void> => useCase.execute(dto({ id: '  ' }))).rejects.toBeInstanceOf(
      InvalidTenantIdException,
    );
    expect(repo.saveCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
  });
});

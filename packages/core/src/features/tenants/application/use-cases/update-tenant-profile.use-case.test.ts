import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdateTenantProfileUseCase } from '@/tenants/application/use-cases/update-tenant-profile.use-case';
import { InMemoryTenantRepository } from '@/testing/in-memory/in-memory-tenant.repository';
import { FakeEventBus } from '@/testing/fakes/fake-event-bus';
import { buildTenant } from '@/testing/builders/tenant.builder';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { TenantSlug } from '@/tenants/domain/value-objects/tenant-slug.vo';
import { TenantStatus } from '@/tenants/domain/enums/tenant-status.enum';
import { TenantNotFoundException } from '@/tenants/application/exceptions/tenant-not-found.exception';
import { TenantSlugAlreadyInUseException } from '@/tenants/application/exceptions/tenant-slug-already-in-use.exception';
import { InvalidTenantStateException } from '@/tenants/domain/exceptions/invalid-tenant-state.exception';
import { InvalidTenantAttributeException } from '@/tenants/domain/exceptions/invalid-tenant-attribute.exception';
import { TenantProfileUpdatedEvent } from '@/tenants/domain/events/tenant-profile-updated.event';
import type { UpdateTenantProfileDto } from '@/tenants/application/dtos/update-tenant-profile.dto';

const NOW = new Date('2026-01-15T12:00:00.000Z');
const ID = 'tenant-1';

function dto(overrides: Partial<UpdateTenantProfileDto> = {}): UpdateTenantProfileDto {
  return {
    tenantId: ID,
    name: 'Renamed store',
    slug: 'test-store',
    contactEmail: 'new@example.com',
    ...overrides,
  };
}

interface Harness {
  repo: InMemoryTenantRepository;
  bus: FakeEventBus;
  useCase: UpdateTenantProfileUseCase;
}

function setup(): Harness {
  const repo = new InMemoryTenantRepository();
  const bus = new FakeEventBus();
  return { repo, bus, useCase: new UpdateTenantProfileUseCase(repo, bus) };
}

describe('UpdateTenantProfileUseCase', (): void => {
  beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach((): void => {
    vi.useRealTimers();
  });

  it('updates the profile, saves and publishes TenantProfileUpdatedEvent', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildTenant());

    await useCase.execute(
      dto({
        taxId: '900',
        customDomain: 'shop.example.com',
        logoUrl: 'https://example.com/l.png',
        bannerUrl: 'https://example.com/b.png',
        description: '  A shop  ',
      }),
    );

    const stored = await repo.findById(createTenantId(ID));
    expect(stored?.getName().getValue()).toBe('Renamed store');
    expect(stored?.getContactEmail().getValue()).toBe('new@example.com');
    expect(stored?.getTaxId()).toBe('900');
    expect(stored?.getCustomDomain()).toBe('shop.example.com');
    expect(stored?.getLogoUrl()).toBe('https://example.com/l.png');
    expect(stored?.getBannerUrl()).toBe('https://example.com/b.png');
    expect(stored?.getDescription()).toBe('A shop');
    expect(stored?.getVersion()).toBe(1);
    expect(repo.updateCount).toBe(1);
    expect(bus.publishedLegacy).toHaveLength(1);
    expect(bus.publishedLegacy[0]).toBeInstanceOf(TenantProfileUpdatedEvent);
  });

  it('clears optional fields when they are omitted', async (): Promise<void> => {
    const { repo, useCase } = setup();
    repo.seed(buildTenant({ taxId: '900', logoUrl: 'https://example.com/l.png' }));

    await useCase.execute(dto());

    const stored = await repo.findById(createTenantId(ID));
    expect(stored?.getTaxId()).toBeNull();
    expect(stored?.getLogoUrl()).toBeNull();
  });

  it('does not check slug uniqueness when the slug is unchanged', async (): Promise<void> => {
    const { repo, useCase } = setup();
    repo.seed(buildTenant());

    await useCase.execute(dto());

    expect(repo.updateCount).toBe(1);
  });

  it('changes to a free slug', async (): Promise<void> => {
    const { repo, useCase } = setup();
    repo.seed(buildTenant());

    await useCase.execute(dto({ slug: 'brand-new' }));

    expect((await repo.findById(createTenantId(ID)))?.getSlug().getValue()).toBe('brand-new');
  });

  it('rejects a slug used by another tenant and writes nothing', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(
      buildTenant(),
      buildTenant({ id: createTenantId('tenant-2'), slug: TenantSlug.create('taken-slug') }),
    );

    await expect((): Promise<void> =>
      useCase.execute(dto({ slug: 'taken-slug' })),
    ).rejects.toBeInstanceOf(TenantSlugAlreadyInUseException);

    expect(repo.updateCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
    expect((await repo.findById(createTenantId(ID)))?.getSlug().getValue()).toBe('test-store');
  });

  it('throws TenantNotFoundException for an unknown tenant', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildTenant({ id: createTenantId('tenant-2'), slug: TenantSlug.create('other') }));

    await expect((): Promise<void> => useCase.execute(dto())).rejects.toBeInstanceOf(
      TenantNotFoundException,
    );

    expect(repo.updateCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
  });

  it('does not touch another tenant when updating one', async (): Promise<void> => {
    const { repo, useCase } = setup();
    repo.seed(
      buildTenant(),
      buildTenant({ id: createTenantId('tenant-2'), slug: TenantSlug.create('other-store') }),
    );

    await useCase.execute(dto());

    const other = await repo.findById(createTenantId('tenant-2'));
    expect(other?.getName().getValue()).toBe('Test store');
    expect(other?.getVersion()).toBe(0);
  });

  it('rejects updating an archived tenant and leaves it unchanged', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildTenant({ status: TenantStatus.ARCHIVED }));

    await expect((): Promise<void> => useCase.execute(dto())).rejects.toBeInstanceOf(
      InvalidTenantStateException,
    );

    expect(repo.updateCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
    expect((await repo.findById(createTenantId(ID)))?.getName().getValue()).toBe('Test store');
  });

  it('rejects a description over 255 characters and writes nothing', async (): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildTenant());

    await expect((): Promise<void> =>
      useCase.execute(dto({ description: 'x'.repeat(256) })),
    ).rejects.toBeInstanceOf(InvalidTenantAttributeException);

    expect(repo.updateCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
  });

  it.each([
    ['empty name', { name: '' }],
    ['invalid slug', { slug: 'Bad Slug' }],
    ['invalid email', { contactEmail: 'nope' }],
  ])('rejects %s and writes nothing', async (_label, overrides): Promise<void> => {
    const { repo, bus, useCase } = setup();
    repo.seed(buildTenant());

    await expect((): Promise<void> => useCase.execute(dto(overrides))).rejects.toThrow();

    expect(repo.updateCount).toBe(0);
    expect(bus.publishedLegacy).toHaveLength(0);
  });
});

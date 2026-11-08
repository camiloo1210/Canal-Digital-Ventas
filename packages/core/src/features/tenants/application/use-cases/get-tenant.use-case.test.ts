import { describe, expect, it } from 'vitest';
import { GetTenantUseCase } from '@/tenants/application/use-cases/get-tenant.use-case';
import { InMemoryTenantRepository } from '@/testing/in-memory/in-memory-tenant.repository';
import { buildTenant } from '@/testing/builders/tenant.builder';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { TenantNotFoundException } from '@/tenants/application/exceptions/tenant-not-found.exception';
import { InvalidTenantAttributeException } from '@/tenants/domain/exceptions/invalid-tenant-attribute.exception';
import { TenantSlug } from '@/tenants/domain/value-objects/tenant-slug.vo';

function setup(): { repo: InMemoryTenantRepository; useCase: GetTenantUseCase } {
  const repo = new InMemoryTenantRepository();
  return { repo, useCase: new GetTenantUseCase(repo) };
}

describe('GetTenantUseCase', (): void => {
  it('returns the tenant by id', async (): Promise<void> => {
    const { repo, useCase } = setup();
    repo.seed(buildTenant());

    const tenant = await useCase.executeById('tenant-1');

    expect(tenant.getId()).toBe('tenant-1');
    expect(tenant.getSlug().getValue()).toBe('test-store');
  });

  it('returns only the requested tenant when several exist', async (): Promise<void> => {
    const { repo, useCase } = setup();
    repo.seed(
      buildTenant(),
      buildTenant({ id: createTenantId('tenant-2'), slug: TenantSlug.create('other-store') }),
    );

    expect((await useCase.executeById('tenant-2')).getSlug().getValue()).toBe('other-store');
    expect((await useCase.executeBySlug('other-store')).getId()).toBe('tenant-2');
  });

  it('returns the tenant by slug', async (): Promise<void> => {
    const { repo, useCase } = setup();
    repo.seed(buildTenant());

    expect((await useCase.executeBySlug('test-store')).getId()).toBe('tenant-1');
  });

  it('throws TenantNotFoundException for an unknown id', async (): Promise<void> => {
    const { repo, useCase } = setup();
    repo.seed(buildTenant());

    await expect((): Promise<unknown> => useCase.executeById('tenant-2')).rejects.toBeInstanceOf(
      TenantNotFoundException,
    );
  });

  it('throws TenantNotFoundException for an unknown slug', async (): Promise<void> => {
    const { useCase } = setup();

    await expect((): Promise<unknown> =>
      useCase.executeBySlug('missing-store'),
    ).rejects.toBeInstanceOf(TenantNotFoundException);
  });

  it('rejects a malformed slug before querying', async (): Promise<void> => {
    const { useCase } = setup();

    await expect((): Promise<unknown> => useCase.executeBySlug('Bad Slug')).rejects.toBeInstanceOf(
      InvalidTenantAttributeException,
    );
  });

  it('returns a fresh instance so mutating it does not change the stored tenant', async (): Promise<void> => {
    const { repo, useCase } = setup();
    repo.seed(buildTenant());

    const tenant = await useCase.executeById('tenant-1');
    tenant.archive();

    expect((await repo.findById(createTenantId('tenant-1')))?.getStatus()).toBe('active');
  });
});

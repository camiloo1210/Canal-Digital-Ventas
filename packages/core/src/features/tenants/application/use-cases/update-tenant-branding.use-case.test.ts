import { describe, it, expect, vi } from 'vitest';
import { UpdateTenantBrandingUseCase } from '@/tenants/application/use-cases/update-tenant-branding.use-case';
import { Tenant } from '@/tenants/domain/entities/tenant.entity';
import { TenantName } from '@/tenants/domain/value-objects/tenant-name.vo';
import { TenantSlug } from '@/tenants/domain/value-objects/tenant-slug.vo';
import { Email } from '@/shared/domain/value-objects/email.vo';
import { Currency } from '@/shared/domain/enums/currency.enum';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';
import { TenantNotFoundException } from '@/tenants/application/exceptions/tenant-not-found.exception';
import { OptimisticConcurrencyException } from '@/shared/application/exceptions/optimistic-concurrency.exception';
import { InvalidTenantAttributeException } from '@/tenants/domain/exceptions/invalid-tenant-attribute.exception';
import { InvalidTenantStateException } from '@/tenants/domain/exceptions/invalid-tenant-state.exception';
import { TenantSlugAlreadyInUseException } from '@/tenants/application/exceptions/tenant-slug-already-in-use.exception';

function fixture(): {
  tenant: Tenant;
  useCase: UpdateTenantBrandingUseCase;
  find: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  publish: ReturnType<typeof vi.fn>;
  isSlugInUse: ReturnType<typeof vi.fn>;
  tx: TransactionContext;
} {
  const tenant = Tenant.create(
    createTenantId('11111111-1111-4111-8111-111111111111'),
    TenantName.create('Original store'),
    TenantSlug.create('original-store'),
    Email.create('store@example.com'),
    Currency.COP,
    'tax-id',
    'store.example.com',
    'https://example.com/logo.png',
    'Original description',
    'https://example.com/banner.png',
  );
  tenant.clearDomainEvents();
  const find = vi.fn().mockResolvedValue(tenant);
  const update = vi.fn().mockResolvedValue(undefined);
  const publish = vi.fn().mockResolvedValue(undefined);
  const isSlugInUse = vi.fn().mockResolvedValue(false);
  const tx: TransactionContext = { executeNative: vi.fn() };
  const transactions: TransactionManagerPort = {
    runInTransaction: async <T>(
      operation: (context: TransactionContext) => Promise<T>,
    ): Promise<T> => operation(tx),
  };
  return {
    tenant,
    find,
    update,
    publish,
    isSlugInUse,
    tx,
    useCase: new UpdateTenantBrandingUseCase(
      { findForManager: find, update, isSlugInUse },
      transactions,
      {
        publish,
      },
    ),
  };
}

const dto = {
  userId: '22222222-2222-4222-8222-222222222222',
  tenantId: '11111111-1111-4111-8111-111111111111',
  name: 'New store',
  slug: 'original-store',
  description: 'New description',
  version: 0,
};

describe('store customization', (): void => {
  it('changes the name and available slug together', async (): Promise<void> => {
    const f = fixture();
    await f.useCase.execute({ ...dto, slug: 'new-store' });
    expect(f.tenant.getName().getValue()).toBe(dto.name);
    expect(f.tenant.getSlug().getValue()).toBe('new-store');
    expect(f.isSlugInUse).toHaveBeenCalledWith('new-store', dto.tenantId, f.tx);
  });

  it('rejects an occupied slug without changing the name or writing events', async (): Promise<void> => {
    const f = fixture();
    f.isSlugInUse.mockResolvedValue(true);
    await expect(f.useCase.execute({ ...dto, slug: 'taken-store' })).rejects.toBeInstanceOf(
      TenantSlugAlreadyInUseException,
    );
    expect(f.tenant.getName().getValue()).toBe('Original store');
    expect(f.update).not.toHaveBeenCalled();
    expect(f.publish).not.toHaveBeenCalled();
  });

  it('allows keeping the current slug without treating it as a duplicate', async (): Promise<void> => {
    const f = fixture();
    await f.useCase.execute(dto);
    expect(f.isSlugInUse).not.toHaveBeenCalled();
  });

  it.each(['ab', 'Uppercase', 'with spaces', 'bad--slug', 'x'.repeat(51)])(
    'rejects invalid slug %s in the domain',
    async (slug: string): Promise<void> => {
      const f = fixture();
      await expect(f.useCase.execute({ ...dto, slug })).rejects.toBeInstanceOf(
        InvalidTenantAttributeException,
      );
      expect(f.update).not.toHaveBeenCalled();
    },
  );

  it('preserves images, store URL and billing identity when editing text; publishes in the same transaction', async (): Promise<void> => {
    const f = fixture();
    await f.useCase.execute(dto);
    expect(f.tenant.getLogoUrl()).toBe('https://example.com/logo.png');
    expect(f.tenant.getBannerUrl()).toBe('https://example.com/banner.png');
    expect(f.tenant.getSlug().getValue()).toBe('original-store');
    expect(f.tenant.getContactEmail().getValue()).toBe('store@example.com');
    expect(f.tenant.getTaxId()).toBe('tax-id');
    expect(f.tenant.getCustomDomain()).toBe('store.example.com');
    expect(f.tenant.getVersion()).toBe(1);
    expect(f.update).toHaveBeenCalledWith(f.tenant, 0, f.tx);
    expect(f.publish).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          context: { tenantId: dto.tenantId, aggregateId: dto.tenantId, aggregateType: 'Tenant' },
        }),
      ],
      f.tx,
    );
  });

  it('replaces the logo and explicitly removes the banner', async (): Promise<void> => {
    const f = fixture();
    await f.useCase.execute({ ...dto, logoUrl: 'https://example.com/new.png', bannerUrl: null });
    expect(f.tenant.getLogoUrl()).toBe('https://example.com/new.png');
    expect(f.tenant.getBannerUrl()).toBeNull();
  });

  it('rejects an unauthorized or missing store before writing or publishing', async (): Promise<void> => {
    const f = fixture();
    f.find.mockResolvedValue(null);
    await expect(f.useCase.execute(dto)).rejects.toBeInstanceOf(TenantNotFoundException);
    expect(f.find).toHaveBeenCalledWith(dto.userId, dto.tenantId, f.tx);
    expect(f.update).not.toHaveBeenCalled();
    expect(f.publish).not.toHaveBeenCalled();
  });

  it('rejects a stale version before changing the aggregate', async (): Promise<void> => {
    const f = fixture();
    await expect(f.useCase.execute({ ...dto, version: 1 })).rejects.toBeInstanceOf(
      OptimisticConcurrencyException,
    );
    expect(f.tenant.getName().getValue()).toBe('Original store');
    expect(f.update).not.toHaveBeenCalled();
    expect(f.publish).not.toHaveBeenCalled();
  });

  it('enforces description limits in the domain', async (): Promise<void> => {
    const f = fixture();
    await expect(
      f.useCase.execute({ ...dto, description: 'x'.repeat(256) }),
    ).rejects.toBeInstanceOf(InvalidTenantAttributeException);
    expect(f.update).not.toHaveBeenCalled();
  });

  it('rejects editing an archived store', async (): Promise<void> => {
    const f = fixture();
    f.tenant.archive();
    await expect(f.useCase.execute({ ...dto, version: 1 })).rejects.toBeInstanceOf(
      InvalidTenantStateException,
    );
    expect(f.update).not.toHaveBeenCalled();
  });

  it('propagates an outbox failure so the transaction manager can roll back', async (): Promise<void> => {
    const f = fixture();
    const failure = new TenantNotFoundException();
    f.publish.mockRejectedValue(failure);
    await expect(f.useCase.execute(dto)).rejects.toBe(failure);
  });
});

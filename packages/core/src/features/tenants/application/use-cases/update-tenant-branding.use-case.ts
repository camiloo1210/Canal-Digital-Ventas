import type { TenantBrandingRepositoryPort } from '@/tenants/application/ports/out/tenant-branding-repository.port';
import type { TransactionManagerPort } from '@/shared/application/ports/out/transaction-manager.port';
import type {
  EventBusPort,
  DomainEventEnvelope,
} from '@/shared/application/ports/out/event-bus.port';
import { TenantNotFoundException } from '@/tenants/application/exceptions/tenant-not-found.exception';
import { OptimisticConcurrencyException } from '@/shared/application/exceptions/optimistic-concurrency.exception';
import { TenantSlug } from '@/tenants/domain/value-objects/tenant-slug.vo';
import { TenantSlugAlreadyInUseException } from '@/tenants/application/exceptions/tenant-slug-already-in-use.exception';

export interface UpdateTenantBrandingDto {
  userId: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  version: number;
}

export class UpdateTenantBrandingUseCase {
  public constructor(
    private readonly repository: TenantBrandingRepositoryPort,
    private readonly transactions: TransactionManagerPort,
    private readonly events: EventBusPort,
  ) {}

  public async execute(dto: UpdateTenantBrandingDto): Promise<void> {
    await this.transactions.runInTransaction(
      async (tx): Promise<void> => {
        const tenant = await this.repository.findForManager(dto.userId, dto.tenantId, tx);
        if (!tenant) throw new TenantNotFoundException();
        if (tenant.getVersion() !== dto.version) {
          throw new OptimisticConcurrencyException('Tenant', dto.tenantId);
        }
        const slug = TenantSlug.create(dto.slug);
        if (
          slug.getValue() !== tenant.getSlug().getValue() &&
          (await this.repository.isSlugInUse(slug.getValue(), dto.tenantId, tx))
        ) {
          throw new TenantSlugAlreadyInUseException();
        }
        tenant.customizeStore(
          dto.name,
          slug,
          dto.description,
          dto.logoUrl === undefined ? tenant.getLogoUrl() : dto.logoUrl,
          dto.bannerUrl === undefined ? tenant.getBannerUrl() : dto.bannerUrl,
        );
        await this.repository.update(tenant, dto.version, tx);
        await this.events.publish(
          tenant.domainEvents.map((event): DomainEventEnvelope => ({
            event,
            context: { tenantId: dto.tenantId, aggregateId: dto.tenantId, aggregateType: 'Tenant' },
          })),
          tx,
        );
        tenant.clearDomainEvents();
      },
      { userId: dto.userId, tenantId: dto.tenantId },
    );
  }
}

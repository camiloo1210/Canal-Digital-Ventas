import { CATEGORY_AGGREGATE_TYPE } from '@/categories/application/outbox/category-aggregate.constants';
import { CreateCategoryDto } from '@/categories/application/dtos/create-category.dto';
import { CategoryRepositoryPort } from '@/categories/application/ports/out/category-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { Category } from '@/categories/domain/entities/category.entity';
import { CategorySlug } from '@/categories/domain/value-objects/category-slug.vo';
import { parseCategoryStatus } from '@/categories/domain/enums/category-status.enum';
import { createCategoryId } from '@/categories/domain/types/category-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';

import { TransactionManagerPort } from '@/shared/application/ports/out/transaction-manager.port';

export class CreateCategoryUseCase {
  constructor(
    private readonly categoryRepository: CategoryRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly transactionManager: TransactionManagerPort,
  ) {}
  async execute(dto: CreateCategoryDto): Promise<void> {
    await this.transactionManager.runInTransaction(
      async (tx) => {
        const categoryId = createCategoryId(dto.id);
        const tenantId = createTenantId(dto.tenantId);
        const slug = CategorySlug.fromName(dto.name);

        const category = Category.create(
          categoryId,
          dto.name,
          slug,
          tenantId,
          dto.description,
          parseCategoryStatus(dto.status),
        );
        await this.categoryRepository.save(category, tx);
        
        if (category.domainEvents.length > 0) {
          const envelopes = category.domainEvents.map((event) => ({
            event,
            context: {
              tenantId: dto.tenantId,
              aggregateType: CATEGORY_AGGREGATE_TYPE,
              aggregateId: category.getId(),
            },
          }));
          await this.eventBus.publish(envelopes, tx);
          category.clearDomainEvents();
        }
      },
      { userId: dto.tenantId },
    );
  }
}

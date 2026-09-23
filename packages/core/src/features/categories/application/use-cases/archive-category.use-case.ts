import { CATEGORY_AGGREGATE_TYPE } from '@/categories/application/outbox/category-aggregate.constants';
import { CategoryRepositoryPort } from '@/categories/application/ports/out/category-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { ArchiveCategoryDto } from '@/categories/application/dtos/archive-category.dto';
import { CategoryNotFoundException } from '@/categories/application/exceptions/category-not-found.exception';
import { CategoryId } from '@/categories/domain/types/category-id.type';

import { createCategoryId } from '@/categories/domain/types/category-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';

import { TransactionManagerPort } from '@/shared/application/ports/out/transaction-manager.port';

export class ArchiveCategoryUseCase {
  constructor(
    private readonly categoryRepository: CategoryRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly transactionManager: TransactionManagerPort,
  ) {}

  async execute(dto: ArchiveCategoryDto): Promise<CategoryId> {
    return await this.transactionManager.runInTransaction(
      async (tx) => {
        const categoryId = createCategoryId(dto.id);
        const tenantId = createTenantId(dto.tenantId);
        const category = await this.categoryRepository.findById(categoryId, tenantId, tx);

        if (!category) {
          throw new CategoryNotFoundException(dto.id);
        }

        category.archive();
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

        return category.getId();
      },
      { userId: dto.tenantId },
    );
  }
}

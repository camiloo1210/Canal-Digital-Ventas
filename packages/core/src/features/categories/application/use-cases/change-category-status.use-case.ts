import { CATEGORY_AGGREGATE_TYPE } from '@/categories/application/outbox/category-aggregate.constants';
import { ChangeCategoryStatusDto } from '@/categories/application/dtos/change-category-status.dto';
import { CategoryRepositoryPort } from '@/categories/application/ports/out/category-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { CategoryNotFoundException } from '@/categories/application/exceptions/category-not-found.exception';
import { parseCategoryStatus } from '@/categories/domain/enums/category-status.enum';
import { createCategoryId } from '@/categories/domain/types/category-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';

import { TransactionManagerPort } from '@/shared/application/ports/out/transaction-manager.port';

export class ChangeCategoryStatusUseCase {
  constructor(
    private readonly categoryRepository: CategoryRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly transactionManager: TransactionManagerPort,
  ) {}

  async execute(dto: ChangeCategoryStatusDto): Promise<void> {
    await this.transactionManager.runInTransaction(
      async (tx) => {
        const categoryId = createCategoryId(dto.id);
        const tenantId = createTenantId(dto.tenantId);

        const category = await this.categoryRepository.findById(categoryId, tenantId, tx);

        if (!category) {
          throw new CategoryNotFoundException(dto.id);
        }

        category.updateStatus(parseCategoryStatus(dto.status));

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

import { ChangeCategoryDetailsDto } from '@/categories/application/dtos/change-category-details.dto';
import { CategoryRepositoryPort } from '@/categories/application/ports/out/category-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { CategoryNotFoundException } from '@/categories/application/exceptions/category-not-found.exception';
import { createCategoryId } from '@/categories/domain/types/category-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';

export class ChangeCategoryDetailsUseCase {
  constructor(
    private readonly categoryRepository: CategoryRepositoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(dto: ChangeCategoryDetailsDto): Promise<void> {
    const categoryId = createCategoryId(dto.id);
    const tenantId = createTenantId(dto.tenantId);

    const category = await this.categoryRepository.findById(categoryId, tenantId);

    if (!category) {
      throw new CategoryNotFoundException(dto.id);
    }

    category.updateName(dto.name);
    category.updateDescription(dto.description);

    await this.categoryRepository.save(category);

    if (category.domainEvents.length > 0) {
      await this.eventBus.publish(category.domainEvents);
    }
    category.clearDomainEvents();
  }
}

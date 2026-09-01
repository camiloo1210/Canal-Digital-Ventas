import { CategoryRepositoryPort } from '@/categories/application/ports/out/category-repository.port';
import { ArchiveCategoryDto } from '@/categories/application/dtos/archive-category.dto';
import { CategoryNotFoundException } from '@/categories/application/exceptions/category-not-found.exception';
import { CategoryId } from '@/categories/domain/types/category-id.type';

import { createCategoryId } from '@/categories/domain/types/category-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';

export class ArchiveCategoryUseCase {
  constructor(private readonly categoryRepository: CategoryRepositoryPort) {}

  async execute(dto: ArchiveCategoryDto): Promise<CategoryId> {
    const categoryId = createCategoryId(dto.id);
    const tenantId = createTenantId(dto.tenantId);
    const category = await this.categoryRepository.findById(categoryId, tenantId);

    if (!category) {
      throw new CategoryNotFoundException(dto.id);
    }

    category.archive();
    await this.categoryRepository.save(category);

    return category.getId();
  }
}

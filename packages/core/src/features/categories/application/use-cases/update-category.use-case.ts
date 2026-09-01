import { UpdateCategoryDto } from '@/categories/application/dtos/update-category.dto';
import { CategoryRepositoryPort } from '@/categories/application/ports/out/category-repository.port';
import { CategoryNotFoundException } from '@/categories/application/exceptions/category-not-found.exception';
import { parseCategoryStatus } from '@/categories/domain/enums/category-status.enum';

import { createCategoryId } from '@/categories/domain/types/category-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';

export class UpdateCategoryUseCase {
  constructor(private readonly categoryRepository: CategoryRepositoryPort) {}

  async execute(dto: UpdateCategoryDto): Promise<void> {
    const categoryId = createCategoryId(dto.id);
    const tenantId = createTenantId(dto.tenantId);

    const category = await this.categoryRepository.findById(categoryId, tenantId);

    if (!category) {
      throw new CategoryNotFoundException(dto.id);
    }

    if (dto.name !== undefined) {
      category.updateName(dto.name);
    }
    if (dto.description !== undefined) {
      category.updateDescription(dto.description);
    }
    if (dto.status !== undefined) {
      category.updateStatus(parseCategoryStatus(dto.status));
    }

    await this.categoryRepository.save(category);
  }
}

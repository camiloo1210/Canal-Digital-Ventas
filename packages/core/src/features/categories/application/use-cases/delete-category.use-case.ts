import { DeleteCategoryDto } from '@/categories/application/dtos/delete-category.dto';
import { CategoryRepositoryPort } from '@/categories/application/ports/out/category-repository.port';
import { CategoryNotFoundException } from '@/categories/application/exceptions/category-not-found.exception';

import { createCategoryId } from '@/categories/domain/types/category-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';

export class DeleteCategoryUseCase {
  constructor(private readonly categoryRepository: CategoryRepositoryPort) {}

  async execute(dto: DeleteCategoryDto): Promise<void> {
    const categoryId = createCategoryId(dto.id);
    const tenantId = createTenantId(dto.tenantId);

    const category = await this.categoryRepository.findById(categoryId, tenantId);

    if (!category) {
      throw new CategoryNotFoundException(dto.id);
    }

    await this.categoryRepository.deleteById(categoryId, tenantId);
  }
}

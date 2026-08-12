import { UpdateCategoryDto } from '@/categories/application/dtos/update-category.dto';
import { CategoryRepositoryPort } from '@/categories/application/ports/out/category-repository.port';
import { CategoryNotFoundException } from '@/categories/application/exceptions/category-not-found.exception';
import { parseCategoryStatus } from '@/categories/domain/enums/category-status.enum';

export class UpdateCategoryUseCase {
  constructor(private readonly categoryRepository: CategoryRepositoryPort) {}

  async execute(dto: UpdateCategoryDto): Promise<void> {
    const category = await this.categoryRepository.findById(dto.id, dto.tenantId);

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

import { CreateCategoryDto } from '@/categories/application/dtos/create-category.dto';
import { CategoryRepositoryPort } from '@/categories/application/ports/out/category-repository.port';
import { Category } from '@/categories/domain/entities/category.entity';
import { parseCategoryStatus } from '@/categories/domain/enums/category-status.enum';
import { createCategoryId } from '@/categories/domain/types/category-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';

export class CreateCategoryUseCase {
  constructor(private readonly categoryRepository: CategoryRepositoryPort) {}
  async execute(dto: CreateCategoryDto): Promise<void> {
    const categoryId = createCategoryId(dto.id);
    const tenantId = createTenantId(dto.tenantId);

    const category = Category.create(
      categoryId,
      dto.name,
      tenantId,
      dto.description,
      parseCategoryStatus(dto.status),
    );
    await this.categoryRepository.save(category);
  }
}

import { CreateCategoryDto } from '@/categories/application/dtos/create-category.dto';
import { CategoryRepositoryPort } from '@/categories/application/ports/out/category-repository.port';
import { Category } from '@/categories/domain/entities/category.entity';
import { parseCategoryStatus } from '@/categories/domain/enums/category-status.enum';
export class CreateCategoryUseCase {
  constructor(private readonly categoryRepository: CategoryRepositoryPort) {}
  async execute(dto: CreateCategoryDto): Promise<void> {
    const category = Category.create(
      dto.id,
      dto.name,
      dto.tenantId,
      dto.description,
      parseCategoryStatus(dto.status),
    );
    await this.categoryRepository.save(category);
  }
}

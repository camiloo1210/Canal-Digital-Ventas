import { SearchCategoriesDto } from '@/categories/application/dtos/search-category.dto';
import { Category } from '@/categories/domain/entities/category.entity';
import { parseCategoryStatus } from '@/categories/domain/enums/category-status.enum';
import { PaginatedResult } from '@/shared/domain/pagination/pagination';
import {
  CategoryRepositoryPort,
  CategoryFilters,
} from '@/categories/application/ports/out/category-repository.port';

export class SearchCategoryUseCase {
  constructor(private readonly categoryRepository: CategoryRepositoryPort) {}

  async execute(dto: SearchCategoriesDto): Promise<PaginatedResult<Category>> {
    const filters: CategoryFilters = {
      id: dto.id,
      name: dto.name,
      tenantId: dto.tenantId,
      status: dto.status ? parseCategoryStatus(dto.status) : undefined,
    };
    return await this.categoryRepository.searchByFilters(filters, dto.pagination);
  }
}

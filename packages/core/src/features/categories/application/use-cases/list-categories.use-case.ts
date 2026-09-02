import { ListCategoriesDto } from '@/categories/application/dtos/list-category.dto';
import { CategoryRepositoryPort } from '@/categories/application/ports/out/category-repository.port';
import { PaginatedResult } from '@/shared/domain/pagination/pagination';
import { Category } from '@/categories/domain/entities/category.entity';

import { createTenantId } from '@/shared/domain/types/tenant-id.type';

export class ListCategoriesUseCase {
  constructor(private readonly categoryRepository: CategoryRepositoryPort) {}

  async execute(dto: ListCategoriesDto): Promise<PaginatedResult<Category>> {
    const tenantId = createTenantId(dto.tenantId);
    return await this.categoryRepository.findAll(tenantId, dto.pagination);
  }
}

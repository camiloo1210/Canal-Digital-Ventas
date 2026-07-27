import { ListCategoriesDto } from '@/categories/application/dtos/list-category.dto';
import { CategoryRepositoryPort } from '@/categories/application/ports/out/category-repository.port';
import { PaginatedResult } from '@/shared/domain/pagination/pagination';
import { Category } from '@/categories/domain/entities/category.entity';

export class ListCategoriesUseCase {


    constructor(private readonly categoryRepository: CategoryRepositoryPort) { }

    async execute(dto: ListCategoriesDto): Promise<PaginatedResult<Category>> {
        return await this.categoryRepository.findAll(dto.tenantId, dto.pagination);
    }
}
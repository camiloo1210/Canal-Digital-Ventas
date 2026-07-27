import { CategoryRepositoryPort } from "@/categories/application/ports/out/category-repository.port";
import { ArchiveCategoryDto } from "@/categories/application/dtos/archive-category.dto";
import { CategoryNotFoundException } from "@/categories/application/exceptions/category-not-found.exception";

export class ArchiveCategoryUseCase {
    constructor(private readonly categoryRepository: CategoryRepositoryPort) { }

    async execute(dto: ArchiveCategoryDto): Promise<string> {
        const category = await this.categoryRepository.findById(dto.id, dto.tenantId);

        if (!category) {
            throw new CategoryNotFoundException(dto.id);
        }

        category.archive();
        await this.categoryRepository.save(category);

        return category.getId();
    }
}
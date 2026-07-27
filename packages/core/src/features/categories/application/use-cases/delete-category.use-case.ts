import { DeleteCategoryDto } from "@/categories/application/dtos/delete-category.dto";
import { CategoryRepositoryPort } from "@/categories/application/ports/out/category-repository.port";
import { CategoryNotFoundException } from "@/categories/application/exceptions/category-not-found.exception";

export class DeleteCategoryUseCase {
    constructor(private readonly categoryRepository: CategoryRepositoryPort) { }

    async execute(dto: DeleteCategoryDto): Promise<void> {
        const category = await this.categoryRepository.findById(dto.id, dto.tenantId);

        if (!category) {
            throw new CategoryNotFoundException(dto.id);
        }

        await this.categoryRepository.deleteById(dto.id, dto.tenantId);
    }
}
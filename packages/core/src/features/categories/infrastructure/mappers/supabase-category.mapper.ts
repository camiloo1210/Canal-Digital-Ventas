import { Category } from '@/categories/domain/entities/category.entity';
import { CategoryStatus } from '@/categories/domain/enums/category-status.enum';
import { DbCategoryRow } from '@/categories/infrastructure/types/supabase-category.types';

export class SupabaseCategoryMapper {
  public static toDomain(row: DbCategoryRow): Category {
    return Category.reconstitute({
      id: row.id,
      name: row.name,
      description: row.description,
      status: row.status as CategoryStatus,
      tenantId: row.tenant_id,
    });
  }

  public static toPersistence(category: Category): DbCategoryRow {
    return {
      id: category.getId(),
      name: category.getName(),
      description: category.getDescription(),
      status: category.getStatus(),
      tenant_id: category.getTenantId(),
    };
  }
}

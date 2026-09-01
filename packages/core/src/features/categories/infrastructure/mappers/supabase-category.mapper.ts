import { Category } from '@/categories/domain/entities/category.entity';
import { CategoryStatus } from '@/categories/domain/enums/category-status.enum';
import { DbCategoryRow } from '@/categories/infrastructure/types/supabase-category.types';
import { CategoryId } from '@/categories/domain/types/category-id.type';
import { TenantId } from '@/shared/domain/types/tenant-id.type';
import { CategoryName } from '@/categories/domain/value-objects/category-name.vo';
import { CategoryDescription } from '@/categories/domain/value-objects/category-description.vo';

export class SupabaseCategoryMapper {
  public static toDomain(row: DbCategoryRow): Category {
    return Category.reconstitute({
      id: row.id as CategoryId,
      name: CategoryName.from(row.name),
      description: CategoryDescription.from(row.description),
      status: row.status as CategoryStatus,
      tenantId: row.tenant_id as TenantId,
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

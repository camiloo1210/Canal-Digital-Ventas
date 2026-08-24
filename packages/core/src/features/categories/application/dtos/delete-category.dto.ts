import { CategoryId } from '@/categories/domain/types/category-id.type';
import { TenantId } from '@/categories/domain/types/tenant-id.type';

export interface DeleteCategoryDto {
  id: CategoryId;
  tenantId: TenantId;
}

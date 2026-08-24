import { CategoryId } from '@/categories/domain/types/category-id.type';
import { TenantId } from '@/categories/domain/types/tenant-id.type';

export interface UpdateCategoryDto {
  id: CategoryId;
  name?: string;
  description?: string;
  status?: string;
  tenantId: TenantId;
}

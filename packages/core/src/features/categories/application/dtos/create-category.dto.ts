import { CategoryId } from '@/categories/domain/types/category-id.type';
import { TenantId } from '@/categories/domain/types/tenant-id.type';

export interface CreateCategoryDto {
  id: CategoryId;
  name: string;
  tenantId: TenantId;
  description: string;
  status: string;
}

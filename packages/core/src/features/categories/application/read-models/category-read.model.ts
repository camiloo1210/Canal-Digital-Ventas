import type { CategoryStatus } from '@/categories/domain/enums/category-status.enum';

export interface CategoryReadModel {
  id: string;
  name: string;
  description: string;
  status: CategoryStatus;
  tenant_id: string;
  version: number;
}

export interface UpdateCategoryDto {
  id: string;
  name?: string;
  description?: string;
  status?: string;
  tenantId: number;
}

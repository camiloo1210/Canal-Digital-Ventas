import { InvalidCategoryStatusException } from '@/categories/domain/exceptions/invalid-category-status.exception';

export enum CategoryStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived',
}

export function parseCategoryStatus(value: string): CategoryStatus {
  const isValid = Object.values(CategoryStatus).includes(value as CategoryStatus);
  if (!isValid) {
    throw new InvalidCategoryStatusException(`'${value}' no es un estado de categoría válido.`);
  }
  return value as CategoryStatus;
}

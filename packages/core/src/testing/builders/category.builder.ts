import { Category, type CategoryProps } from '@/categories/domain/entities/category.entity';
import { CategoryStatus } from '@/categories/domain/enums/category-status.enum';
import { createCategoryId } from '@/categories/domain/types/category-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { CategoryName } from '@/categories/domain/value-objects/category-name.vo';
import { CategorySlug } from '@/categories/domain/value-objects/category-slug.vo';
import { CategoryDescription } from '@/categories/domain/value-objects/category-description.vo';
import { DEFAULT_TEST_TENANT_ID } from '@/testing/builders/product.builder';

/** Valid, event-free category (reconstituted). Deterministic: no clock, no random ids. */
export function buildCategory(overrides: Partial<CategoryProps> = {}): Category {
  return Category.reconstitute({
    id: createCategoryId('category-1'),
    name: CategoryName.from('Beverages'),
    slug: CategorySlug.create('beverages'),
    tenantId: createTenantId(DEFAULT_TEST_TENANT_ID),
    description: CategoryDescription.from('Cold and hot drinks'),
    status: CategoryStatus.ACTIVE,
    version: 1,
    ...overrides,
  });
}

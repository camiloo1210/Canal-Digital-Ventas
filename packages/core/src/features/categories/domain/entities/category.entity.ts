import { CategoryStatus } from '@/categories/domain/enums/category-status.enum';
import { InvalidTenantIdException } from '@/shared/domain/exceptions/invalid-tenant-id.exception';
import { CategoryName } from '@/categories/domain/value-objects/category-name.vo';
import { CategoryDescription } from '@/categories/domain/value-objects/category-description.vo';
import { InvalidCategoryStatusException } from '@/categories/domain/exceptions/invalid-category-status.exception';

export interface CategoryProps {
  id: string;
  name: string;
  tenantId: number;
  description: string;
  status: CategoryStatus;
}

export class Category {
  private constructor(
    private readonly id: string,
    private name: CategoryName,
    private readonly tenantId: number,
    private description: CategoryDescription,
    private status: CategoryStatus,
  ) {}

  public static create(
    id: string,
    name: string,
    tenantId: number,
    description: string,
    status: CategoryStatus,
  ): Category {
    Category.validateId(id);
    Category.validateTenantId(tenantId);
    Category.validateStatus(status);

    return new Category(
      id,
      CategoryName.from(name),
      tenantId,
      CategoryDescription.from(description),
      status,
    );
  }

  // Reconstitute
  public static reconstitute(props: CategoryProps): Category {
    Category.validateId(props.id);
    Category.validateTenantId(props.tenantId);
    Category.validateStatus(props.status);

    return new Category(
      props.id,
      CategoryName.from(props.name),
      props.tenantId,
      CategoryDescription.from(props.description),
      props.status,
    );
  }

  // Validations
  private static validateTenantId(tenantId: number): void {
    if (tenantId === undefined || tenantId === null) {
      throw new InvalidTenantIdException('is required.');
    }
  }

  private static validateStatus(status: CategoryStatus): void {
    if (!status || !Object.values(CategoryStatus).includes(status)) {
      throw new InvalidCategoryStatusException(
        'Status is required and must be a valid category status.',
      );
    }
  }

  private static validateId(id: string): void {
    if (!id) {
      throw new Error('ID is required.');
    }
  }

  // Actions
  public archive(): void {
    if (this.status === CategoryStatus.ARCHIVED) {
      throw new InvalidCategoryStatusException('Category is already archived.');
    }
    this.status = CategoryStatus.ARCHIVED;
  }

  // Updates
  public updateStatus(newStatus: CategoryStatus): void {
    if (this.status === CategoryStatus.ARCHIVED) {
      throw new InvalidCategoryStatusException('Cannot change the status of an archived category.');
    }
    Category.validateStatus(newStatus);
    this.status = newStatus;
  }

  public updateName(newName: string): void {
    this.name = CategoryName.from(newName);
  }

  public updateDescription(newDescription: string): void {
    this.description = CategoryDescription.from(newDescription);
  }

  // Getters
  public getId(): string {
    return this.id;
  }

  public getName(): string {
    return this.name.getValue();
  }

  public getTenantId(): number {
    return this.tenantId;
  }

  public getDescription(): string {
    return this.description.getValue();
  }

  public getStatus(): CategoryStatus {
    return this.status;
  }
}

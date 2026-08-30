import { CategoryStatus } from '@/categories/domain/enums/category-status.enum';
import { InvalidTenantIdException } from '@/shared/domain/exceptions/invalid-tenant-id.exception';
import { CategoryName } from '@/categories/domain/value-objects/category-name.vo';
import { CategoryDescription } from '@/categories/domain/value-objects/category-description.vo';
import { InvalidCategoryStatusException } from '@/categories/domain/exceptions/invalid-category-status.exception';
import { InvalidCategoryAttributeException } from '@/categories/domain/exceptions/invalid-category-attribute.exception';
import { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import { CategoryId } from '@/categories/domain/types/category-id.type';
import { TenantId } from '@/categories/domain/types/tenant-id.type';

export interface CategoryProps {
  id: CategoryId;
  name: string;
  tenantId: TenantId;
  description: string;
  status: CategoryStatus;
}

export class Category {
  private readonly _domainEvents: DomainEvent[] = [];

  private constructor(
    private readonly id: CategoryId,
    private name: CategoryName,
    private readonly tenantId: TenantId,
    private description: CategoryDescription,
    private status: CategoryStatus,
  ) {}

  public static create(
    id: CategoryId,
    name: string,
    tenantId: TenantId,
    description: string,
    status: CategoryStatus,
  ): Category {
    Category.validateId(id);
    Category.validateTenantId(tenantId);
    Category.validateStatus(status);

    const category = new Category(
      id,
      CategoryName.from(name),
      tenantId,
      CategoryDescription.from(description),
      status,
    );

    category.addDomainEvent({ eventName: 'CategoryCreatedEvent', categoryId: id });
    return category;
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
  private static validateTenantId(tenantId: TenantId): void {
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim().length === 0) {
      throw new InvalidTenantIdException('Tenant ID is required and must be a valid string.');
    }
  }

  private static validateStatus(status: CategoryStatus): void {
    if (!status || !Object.values(CategoryStatus).includes(status)) {
      throw new InvalidCategoryStatusException(
        'Status is required and must be a valid category status.',
      );
    }
  }

  private static validateId(id: CategoryId): void {
    if (!id || id.trim().length === 0) {
      throw new InvalidCategoryAttributeException('Category ID is required.');
    }
  }

  // Actions
  public archive(): void {
    if (this.status === CategoryStatus.ARCHIVED) {
      throw new InvalidCategoryStatusException('Category is already archived.');
    }
    this.status = CategoryStatus.ARCHIVED;
    this.addDomainEvent({ eventName: 'CategoryArchivedEvent', categoryId: this.id });
  }

  // Updates
  public updateStatus(newStatus: CategoryStatus): void {
    if (this.status === CategoryStatus.ARCHIVED) {
      throw new InvalidCategoryStatusException('Cannot change the status of an archived category.');
    }
    Category.validateStatus(newStatus);
    this.status = newStatus;
    this.addDomainEvent({
      eventName: 'CategoryStatusUpdatedEvent',
      categoryId: this.id,
      newStatus,
    });
  }

  public updateName(newName: string): void {
    this.name = CategoryName.from(newName);
    this.addDomainEvent({ eventName: 'CategoryNameUpdatedEvent', categoryId: this.id, newName });
  }

  public updateDescription(newDescription: string): void {
    this.description = CategoryDescription.from(newDescription);
    this.addDomainEvent({
      eventName: 'CategoryDescriptionUpdatedEvent',
      categoryId: this.id,
      newDescription,
    });
  }

  private addDomainEvent(event: Omit<DomainEvent, 'occurredOn'>): void {
    this._domainEvents.push({
      ...event,
      occurredOn: new Date(),
    } as DomainEvent);
  }

  public get domainEvents(): DomainEvent[] {
    return [...this._domainEvents];
  }

  public clearDomainEvents(): void {
    this._domainEvents.length = 0;
  }

  // Getters
  public getId(): CategoryId {
    return this.id;
  }

  public getName(): string {
    return this.name.getValue();
  }

  public getTenantId(): TenantId {
    return this.tenantId;
  }

  public getDescription(): string {
    return this.description.getValue();
  }

  public getStatus(): CategoryStatus {
    return this.status;
  }
}

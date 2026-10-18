import { StoreCustomerId } from '@/sales/domain/types/customer-id.type';
import { GlobalAuthId } from '@/sales/domain/types/global-auth-id.type';
import { TenantId } from '@/shared/domain/types/tenant-id.type';
import { StoreCustomerStatus } from '@/sales/domain/enums/store-customer-status.enum';
import { InvalidStoreCustomerAttributeException } from '@/sales/domain/exceptions/invalid-store-customer-attribute.exception';
import { InvalidTenantIdException } from '@/shared/domain/exceptions/invalid-tenant-id.exception';
import { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import { StoreCustomerCreatedEvent } from '@/sales/domain/events/store-customer-created.event';

export interface StoreCustomerProps {
  id: StoreCustomerId;
  tenantId: TenantId;
  globalAuthId: GlobalAuthId;
  status: StoreCustomerStatus;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export class StoreCustomer {
  private readonly _domainEvents: DomainEvent[] = [];

  private constructor(
    private readonly id: StoreCustomerId,
    private readonly tenantId: TenantId,
    private readonly globalAuthId: GlobalAuthId,
    private status: StoreCustomerStatus,
    private readonly createdAt: Date,
    private updatedAt: Date,
    private version: number,
  ) {}

  public static create(
    id: StoreCustomerId,
    tenantId: TenantId,
    globalAuthId: GlobalAuthId,
  ): StoreCustomer {
    StoreCustomer.validateId(id);
    StoreCustomer.validateTenantId(tenantId);
    StoreCustomer.validateGlobalAuthId(globalAuthId);

    const customer = new StoreCustomer(
      id,
      tenantId,
      globalAuthId,
      StoreCustomerStatus.ACTIVE,
      new Date(),
      new Date(),
      0,
    );

    customer.addDomainEvent(new StoreCustomerCreatedEvent(id, tenantId));
    return customer;
  }

  // Validations
  private static validateId(id: StoreCustomerId): void {
    if (!id || id.trim().length === 0) {
      throw new InvalidStoreCustomerAttributeException('Store Customer ID is required.');
    }
  }

  private static validateTenantId(tenantId: TenantId): void {
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim().length === 0) {
      throw new InvalidTenantIdException('Tenant ID is required and must be a valid string.');
    }
  }

  private static validateGlobalAuthId(globalAuthId: GlobalAuthId): void {
    if (!globalAuthId || globalAuthId.trim().length === 0) {
      throw new InvalidStoreCustomerAttributeException('Global Auth ID is required.');
    }
  }

  // Actions
  public suspend(): void {
    if (this.status === StoreCustomerStatus.SUSPENDED) {
      return;
    }
    this.status = StoreCustomerStatus.SUSPENDED;
    this.updateUpdatedAt();
  }

  public activate(): void {
    if (this.status === StoreCustomerStatus.ACTIVE) {
      return;
    }
    this.status = StoreCustomerStatus.ACTIVE;
    this.updateUpdatedAt();
  }

  private updateUpdatedAt(): void {
    this.updatedAt = new Date();
    this.version++;
  }

  // Reconstitute
  public static reconstitute(props: StoreCustomerProps): StoreCustomer {
    return new StoreCustomer(
      props.id,
      props.tenantId,
      props.globalAuthId,
      props.status,
      props.createdAt,
      props.updatedAt,
      props.version,
    );
  }

  // Domain Events Management
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
  public getId(): StoreCustomerId {
    return this.id;
  }

  public getTenantId(): TenantId {
    return this.tenantId;
  }

  public getGlobalAuthId(): GlobalAuthId {
    return this.globalAuthId;
  }

  public getStatus(): StoreCustomerStatus {
    return this.status;
  }

  public getCreatedAt(): Date {
    return this.createdAt;
  }

  public getUpdatedAt(): Date {
    return this.updatedAt;
  }

  public getVersion(): number {
    return this.version;
  }
}

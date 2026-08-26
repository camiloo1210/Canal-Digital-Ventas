import { CustomerId } from '@/customers/domain/types/customer-id.type';
import { TenantId } from '@/customers/domain/types/tenant-id.type';
import { CustomerStatus } from '@/customers/domain/enums/customer-status.enum';
import { CustomerName } from '@/customers/domain/value-objects/customer-name.vo';
import { Email } from '@/customers/domain/value-objects/email.vo';
import { PhoneNumber } from '@/customers/domain/value-objects/phone-number.vo';
import { DocumentId } from '@/customers/domain/value-objects/document-id.vo';
import { Address } from '@/shared/domain/value-objects/adress.vo';
import { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import { InvalidCustomerAttributeException } from '@/customers/domain/exceptions/invalid-customer-attribute.exception';
import { InvalidCustomerStateException } from '@/customers/domain/exceptions/invalid-customer-state.exception';
import { InvalidTenantIdException } from '@/shared/domain/exceptions/invalid-tenant-id.exception';

export interface CustomerProps {
  id: CustomerId;
  tenantId: TenantId;
  name: CustomerName;
  email: Email;
  phone: PhoneNumber;
  documentId: DocumentId;
  status: CustomerStatus;
  address: Address;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export class Customer {
  private readonly _domainEvents: DomainEvent[] = [];

  private constructor(
    private readonly id: CustomerId,
    private readonly tenantId: TenantId,
    private name: CustomerName,
    private email: Email,
    private phone: PhoneNumber,
    private readonly documentId: DocumentId,
    private status: CustomerStatus,
    private address: Address,
    private readonly createdAt: Date,
    private updatedAt: Date,
    private version: number,
  ) {}

  public static create(
    id: CustomerId,
    tenantId: TenantId,
    name: CustomerName,
    email: Email,
    phone: PhoneNumber,
    documentId: DocumentId,
    address: Address,
  ): Customer {
    Customer.validateId(id);
    Customer.validateTenantId(tenantId);
    Customer.validateAddress(address);

    const customer = new Customer(
      id,
      tenantId,
      name,
      email,
      phone,
      documentId,
      CustomerStatus.ACTIVE,
      address,
      new Date(),
      new Date(),
      0, // Initial version
    );

    customer.addDomainEvent({ eventName: 'CustomerCreatedEvent', customerId: id });
    return customer;
  }

  // Validations
  private static validateId(id: CustomerId): void {
    if (!id || id.trim().length === 0) {
      throw new InvalidCustomerAttributeException('Customer ID is required.');
    }
  }

  private static validateTenantId(tenantId: TenantId): void {
    if (tenantId === undefined || tenantId === null || tenantId <= 0) {
      throw new InvalidTenantIdException('Tenant ID is required and must be a positive number.');
    }
  }

  private static validateAddress(address: Address): void {
    if (!address) {
      throw new InvalidCustomerAttributeException('Address is required for creating a customer.');
    }
  }

  // Updates / Actions
  public updateProfile(name: CustomerName, phone: PhoneNumber): void {
    if (this.status === CustomerStatus.SUSPENDED) {
      throw new InvalidCustomerStateException('Cannot update profile for a suspended customer.');
    }
    this.name = name;
    this.phone = phone;
    this.updateUpdatedAt();
    this.addDomainEvent({ eventName: 'CustomerProfileUpdatedEvent', customerId: this.id });
  }

  public changeAddress(address: Address): void {
    Customer.validateAddress(address);
    if (this.status === CustomerStatus.SUSPENDED) {
      throw new InvalidCustomerStateException('Cannot change address for a suspended customer.');
    }
    this.address = address;
    this.updateUpdatedAt();
    this.addDomainEvent({ eventName: 'CustomerAddressChangedEvent', customerId: this.id });
  }

  public suspend(): void {
    if (this.status === CustomerStatus.SUSPENDED) {
      throw new InvalidCustomerStateException('Customer is already suspended.');
    }
    this.status = CustomerStatus.SUSPENDED;
    this.updateUpdatedAt();
    this.addDomainEvent({ eventName: 'CustomerSuspendedEvent', customerId: this.id });
  }

  public activate(): void {
    if (this.status === CustomerStatus.ACTIVE) {
      throw new InvalidCustomerStateException('Customer is already active.');
    }
    this.status = CustomerStatus.ACTIVE;
    this.updateUpdatedAt();
    this.addDomainEvent({ eventName: 'CustomerActivatedEvent', customerId: this.id });
  }

  public deactivate(): void {
    if (this.status === CustomerStatus.INACTIVE) {
      throw new InvalidCustomerStateException('Customer is already inactive.');
    }
    this.status = CustomerStatus.INACTIVE;
    this.updateUpdatedAt();
    this.addDomainEvent({ eventName: 'CustomerDeactivatedEvent', customerId: this.id });
  }

  private updateUpdatedAt(): void {
    this.updatedAt = new Date();
    this.version++;
  }

  // Reconstitute
  public static reconstitute(props: CustomerProps): Customer {
    return new Customer(
      props.id,
      props.tenantId,
      props.name,
      props.email,
      props.phone,
      props.documentId,
      props.status,
      props.address,
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
  public getId(): CustomerId {
    return this.id;
  }

  public getTenantId(): TenantId {
    return this.tenantId;
  }

  public getName(): CustomerName {
    return this.name;
  }

  public getEmail(): Email {
    return this.email;
  }

  public getPhone(): PhoneNumber {
    return this.phone;
  }

  public getDocumentId(): DocumentId {
    return this.documentId;
  }

  public getStatus(): CustomerStatus {
    return this.status;
  }

  public getAddress(): Address {
    return this.address;
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

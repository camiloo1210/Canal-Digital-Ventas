import { TenantId } from '@/tenants/domain/types/tenant-id.type';
import { TenantStatus } from '@/tenants/domain/enums/tenant-status.enum';
import { TenantName } from '@/tenants/domain/value-objects/tenant-name.vo';
import { TenantSlug } from '@/tenants/domain/value-objects/tenant-slug.vo';
import { Email } from '@/shared/domain/value-objects/email.vo';
import { Currency } from '@/shared/domain/enums/currency.enum';
import { DomainEvent } from '@/shared/domain/events/domain-event.interface';
import { InvalidTenantAttributeException } from '@/tenants/domain/exceptions/invalid-tenant-attribute.exception';
import { InvalidTenantStateException } from '@/tenants/domain/exceptions/invalid-tenant-state.exception';

export interface TenantProps {
  id: TenantId;
  name: TenantName;
  slug: TenantSlug;
  contactEmail: Email;
  baseCurrency: Currency;
  status: TenantStatus;
  taxId: string | null;
  customDomain: string | null;
  logoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export class Tenant {
  private readonly _domainEvents: DomainEvent[] = [];

  private constructor(
    private readonly id: TenantId,
    private name: TenantName,
    private slug: TenantSlug,
    private contactEmail: Email,
    private readonly baseCurrency: Currency,
    private status: TenantStatus,
    private taxId: string | null,
    private customDomain: string | null,
    private logoUrl: string | null,
    private readonly createdAt: Date,
    private updatedAt: Date,
    private version: number,
  ) {}

  public static create(
    id: TenantId,
    name: TenantName,
    slug: TenantSlug,
    contactEmail: Email,
    baseCurrency: Currency,
    taxId: string | null = null,
    customDomain: string | null = null,
    logoUrl: string | null = null,
  ): Tenant {
    Tenant.validateId(id);
    Tenant.validateCurrency(baseCurrency);

    const tenant = new Tenant(
      id,
      name,
      slug,
      contactEmail,
      baseCurrency,
      TenantStatus.PENDING_SETUP,
      taxId,
      customDomain,
      logoUrl,
      new Date(),
      new Date(),
      0,
    );

    tenant.addDomainEvent({ eventName: 'TenantCreatedEvent', tenantId: id });
    return tenant;
  }

  public static reconstitute(props: TenantProps): Tenant {
    return new Tenant(
      props.id,
      props.name,
      props.slug,
      props.contactEmail,
      props.baseCurrency,
      props.status,
      props.taxId,
      props.customDomain,
      props.logoUrl,
      props.createdAt,
      props.updatedAt,
      props.version,
    );
  }

  // Validations
  private static validateId(id: TenantId): void {
    if (!id || id.trim().length === 0) {
      throw new InvalidTenantAttributeException('Tenant ID is required.');
    }
  }

  private static validateCurrency(currency: Currency): void {
    if (!currency || !Object.values(Currency).includes(currency)) {
      throw new InvalidTenantAttributeException('Valid base currency is required.');
    }
  }

  private updateUpdatedAt(): void {
    this.updatedAt = new Date();
    this.version++;
  }

  // Business Actions
  public activate(): void {
    if (this.status === TenantStatus.ARCHIVED) {
      throw new InvalidTenantStateException('Cannot activate an archived tenant.');
    }
    if (this.status === TenantStatus.ACTIVE) {
      throw new InvalidTenantStateException('Tenant is already active.');
    }

    this.status = TenantStatus.ACTIVE;
    this.updateUpdatedAt();
    this.addDomainEvent({ eventName: 'TenantActivatedEvent', tenantId: this.id });
  }

  public suspend(reason: string): void {
    if (this.status === TenantStatus.ARCHIVED) {
      throw new InvalidTenantStateException('Cannot suspend an archived tenant.');
    }
    if (this.status === TenantStatus.SUSPENDED) {
      throw new InvalidTenantStateException('Tenant is already suspended.');
    }
    if (!reason || reason.trim().length === 0) {
      throw new InvalidTenantAttributeException('Suspension reason is required.');
    }

    this.status = TenantStatus.SUSPENDED;
    this.updateUpdatedAt();
    this.addDomainEvent({ eventName: 'TenantSuspendedEvent', tenantId: this.id, reason });
  }

  public archive(): void {
    if (this.status === TenantStatus.ARCHIVED) {
      throw new InvalidTenantStateException('Tenant is already archived.');
    }

    this.status = TenantStatus.ARCHIVED;
    this.updateUpdatedAt();
    this.addDomainEvent({ eventName: 'TenantArchivedEvent', tenantId: this.id });
  }

  public updateProfile(
    name: TenantName,
    slug: TenantSlug,
    contactEmail: Email,
    taxId: string | null = null,
    customDomain: string | null = null,
    logoUrl: string | null = null,
  ): void {
    if (this.status === TenantStatus.ARCHIVED) {
      throw new InvalidTenantStateException('Cannot update an archived tenant.');
    }

    this.name = name;
    this.slug = slug;
    this.contactEmail = contactEmail;
    this.taxId = taxId;
    this.customDomain = customDomain;
    this.logoUrl = logoUrl;

    this.updateUpdatedAt();
    this.addDomainEvent({ eventName: 'TenantProfileUpdatedEvent', tenantId: this.id });
  }

  // Domain Events
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
  public getId(): TenantId {
    return this.id;
  }
  public getName(): TenantName {
    return this.name;
  }
  public getSlug(): TenantSlug {
    return this.slug;
  }
  public getContactEmail(): Email {
    return this.contactEmail;
  }
  public getBaseCurrency(): Currency {
    return this.baseCurrency;
  }
  public getStatus(): TenantStatus {
    return this.status;
  }
  public getTaxId(): string | null {
    return this.taxId;
  }
  public getCustomDomain(): string | null {
    return this.customDomain;
  }
  public getLogoUrl(): string | null {
    return this.logoUrl;
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

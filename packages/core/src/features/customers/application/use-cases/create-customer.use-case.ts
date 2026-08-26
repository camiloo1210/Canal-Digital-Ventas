import { CustomerRepositoryPort } from '@/customers/application/ports/out/customer-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { CreateCustomerDto } from '@/customers/application/dtos/create-customer.dto';
import { Customer } from '@/customers/domain/entities/customer.entity';
import { CustomerName } from '@/customers/domain/value-objects/customer-name.vo';
import { Email } from '@/customers/domain/value-objects/email.vo';
import { PhoneNumber } from '@/customers/domain/value-objects/phone-number.vo';
import { DocumentId } from '@/customers/domain/value-objects/document-id.vo';
import { Address } from '@/shared/domain/value-objects/adress.vo';

export class CreateCustomerUseCase {
  constructor(
    private readonly customerRepository: CustomerRepositoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(dto: CreateCustomerDto): Promise<void> {
    const name = CustomerName.from(dto.name);
    const email = Email.from(dto.email);
    const phone = PhoneNumber.from(dto.phone);
    const documentId = DocumentId.from(dto.documentId);
    const address = Address.create(
      dto.address.street,
      dto.address.city,
      dto.address.state,
      dto.address.zipCode,
      dto.address.country,
    );

    const customer = Customer.create(dto.id, dto.tenantId, name, email, phone, documentId, address);

    await this.customerRepository.save(customer);
    await this.eventBus.publish(customer.domainEvents);
    customer.clearDomainEvents();
  }
}

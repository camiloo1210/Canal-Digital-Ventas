import { CustomerRepositoryPort } from '@/customers/application/ports/out/customer-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { UpdateCustomerProfileDto } from '@/customers/application/dtos/update-customer-profile.dto';
import { CustomerNotFoundException } from '@/customers/application/exceptions/customer-not-found.exception';
import { CustomerName } from '@/customers/domain/value-objects/customer-name.vo';
import { PhoneNumber } from '@/customers/domain/value-objects/phone-number.vo';

export class UpdateCustomerProfileUseCase {
  constructor(
    private readonly customerRepository: CustomerRepositoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(dto: UpdateCustomerProfileDto): Promise<void> {
    const customer = await this.customerRepository.findById(dto.customerId, dto.tenantId);

    if (!customer) {
      throw new CustomerNotFoundException();
    }

    const newName = CustomerName.from(dto.name);
    const newPhone = PhoneNumber.from(dto.phone);

    customer.updateProfile(newName, newPhone);

    await this.customerRepository.save(customer);
    await this.eventBus.publish(customer.domainEvents);
    customer.clearDomainEvents();
  }
}

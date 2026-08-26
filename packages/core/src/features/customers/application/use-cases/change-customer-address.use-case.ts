import { CustomerRepositoryPort } from '@/customers/application/ports/out/customer-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { ChangeCustomerAddressDto } from '@/customers/application/dtos/change-customer-address.dto';
import { CustomerNotFoundException } from '@/customers/application/exceptions/customer-not-found.exception';
import { Address } from '@/shared/domain/value-objects/adress.vo';

export class ChangeCustomerAddressUseCase {
  constructor(
    private readonly customerRepository: CustomerRepositoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(dto: ChangeCustomerAddressDto): Promise<void> {
    const customer = await this.customerRepository.findById(dto.customerId, dto.tenantId);

    if (!customer) {
      throw new CustomerNotFoundException();
    }

    const newAddress = Address.create(
      dto.address.street,
      dto.address.city,
      dto.address.state,
      dto.address.zipCode,
      dto.address.country,
    );

    customer.changeAddress(newAddress);

    await this.customerRepository.save(customer);
    await this.eventBus.publish(customer.domainEvents);
    customer.clearDomainEvents();
  }
}

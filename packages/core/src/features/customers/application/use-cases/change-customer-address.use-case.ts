import { CustomerRepositoryPort } from '@/customers/application/ports/out/customer-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { ChangeCustomerAddressDto } from '@/customers/application/dtos/change-customer-address.dto';
import { CustomerNotFoundException } from '@/customers/application/exceptions/customer-not-found.exception';
import { Address } from '@/shared/domain/value-objects/adress.vo';

import { createCustomerId } from '@/customers/domain/types/customer-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';

export class ChangeCustomerAddressUseCase {
  constructor(
    private readonly customerRepository: CustomerRepositoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(dto: ChangeCustomerAddressDto): Promise<void> {
    const customerId = createCustomerId(dto.customerId);
    const tenantId = createTenantId(dto.tenantId);

    const customer = await this.customerRepository.findById(customerId, tenantId);

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

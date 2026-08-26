import { CustomerRepositoryPort } from '@/customers/application/ports/out/customer-repository.port';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { ChangeCustomerStatusDto } from '@/customers/application/dtos/change-customer-status.dto';
import { CustomerNotFoundException } from '@/customers/application/exceptions/customer-not-found.exception';
import { UnsupportedCustomerStatusException } from '@/customers/application/exceptions/unsupported-customer-status.exception';
import { CustomerStatus } from '@/customers/domain/enums/customer-status.enum';

export class ChangeCustomerStatusUseCase {
  constructor(
    private readonly customerRepository: CustomerRepositoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(dto: ChangeCustomerStatusDto): Promise<void> {
    const customer = await this.customerRepository.findById(dto.customerId, dto.tenantId);

    if (!customer) {
      throw new CustomerNotFoundException();
    }

    switch (dto.status) {
      case CustomerStatus.ACTIVE:
        customer.activate();
        break;
      case CustomerStatus.INACTIVE:
        customer.deactivate();
        break;
      case CustomerStatus.SUSPENDED:
        customer.suspend();
        break;
      default:
        throw new UnsupportedCustomerStatusException(dto.status);
    }

    await this.customerRepository.save(customer);
    await this.eventBus.publish(customer.domainEvents);
    customer.clearDomainEvents();
  }
}

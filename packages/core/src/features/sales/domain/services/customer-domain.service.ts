import { StoreCustomerRepositoryPort } from '@/sales/application/ports/out/customer-repository.port';
import { StoreCustomer } from '@/sales/domain/entities/store-customer.entity';
import { createStoreCustomerId } from '@/sales/domain/types/customer-id.type';
import { GlobalAuthId } from '@/sales/domain/types/global-auth-id.type';
import { TenantId } from '@/shared/domain/types/tenant-id.type';

export class StoreCustomerDomainService {
  constructor(private readonly customerRepository: StoreCustomerRepositoryPort) {}

  /**
   * Ensures a StoreCustomer record exists for the given tenant and globalAuthId.
   * If it doesn't exist, it performs Just-In-Time (JIT) provisioning.
   *
   * This is a Domain Service, not a Use Case. It encapsulates the domain rule:
   * "A global buyer must have a localized customer record per tenant store."
   * Use Cases (e.g., CheckoutUseCase) delegate to this service.
   */
  async ensureCustomerExists(
    tenantId: TenantId,
    globalAuthId: GlobalAuthId,
  ): Promise<StoreCustomer> {
    const existingCustomer = await this.customerRepository.findByTenantAndGlobalAuthId(
      tenantId,
      globalAuthId,
    );

    if (existingCustomer) {
      return existingCustomer;
    }

    // JIT Provisioning — uses Node.js native crypto, no external dependencies.
    const newCustomer = StoreCustomer.create(
      createStoreCustomerId(crypto.randomUUID()),
      tenantId,
      globalAuthId,
    );

    await this.customerRepository.save(newCustomer);
    return newCustomer;
  }
}

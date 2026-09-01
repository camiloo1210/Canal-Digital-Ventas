import { CustomerRepositoryPort } from '@/customers/application/ports/out/customer-repository.port';
import { SearchCustomersDto } from '@/customers/application/dtos/search-customers.dto';
import { PaginatedResult } from '@/shared/domain/pagination/pagination';
import { Customer } from '@/customers/domain/entities/customer.entity';

import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { CustomerStatus } from '@/customers/domain/enums/customer-status.enum';

export class SearchCustomersUseCase {
  constructor(private readonly customerRepository: CustomerRepositoryPort) {}

  async execute(dto: SearchCustomersDto): Promise<PaginatedResult<Customer>> {
    return this.customerRepository.searchByFilters(
      {
        tenantId: createTenantId(dto.tenantId),
        searchTerm: dto.searchTerm,
        status: dto.status as CustomerStatus[],
      },
      dto.pagination,
    );
  }
}
